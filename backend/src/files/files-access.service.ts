import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { RequestUser } from '../common/student-access.service';

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS'];

/** Where a file belongs: a school, and a campus when the owning record has one. */
interface FileHome {
  schoolId: string;
  campusId: string | null;
}

const CAMPUS = { select: { id: true, schoolId: true } } as const;

/**
 * File-scoped counterpart to StudentAccessService.
 * - SUPER_ADMIN and the uploader may read a file.
 * - Staff may read a file that belongs to their school (their campus, for campus-level users) —
 *   through whatever record it is attached to (KG-30: staff used to read any school's files).
 * - A parent may read a file attached to a diary entry in their child's section, a circular they
 *   received, or a complaint about their child they may see (BL-30).
 */
@Injectable()
export class FilesAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  async assertCanAccessFile(user: RequestUser, fileId: string): Promise<void> {
    if (user.role === 'SUPER_ADMIN') return;
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { uploadedById: true },
    });
    if (!file) throw new NotFoundException('File not found');
    if (file.uploadedById && file.uploadedById === user.id) return;

    if (STAFF_ROLES.includes(user.role)) {
      const scope = await this.orgScope.resolve(user);
      const homes = await this.homesOf(fileId);
      const inScope = homes.some(
        (h) =>
          h.schoolId === scope.schoolId &&
          (scope.campusId === null ||
            h.campusId === null ||
            h.campusId === scope.campusId),
      );
      if (!scope.denied && inScope) return;
      throw new ForbiddenException('You do not have access to this file');
    }

    const viaDiary = await this.prisma.diaryAttachment.findFirst({
      where: {
        fileId,
        diaryEntry: {
          section: {
            enrollments: {
              some: {
                status: 'ACTIVE',
                student: {
                  parents: { some: { parentProfile: { userId: user.id } } },
                },
              },
            },
          },
        },
      },
    });
    if (viaDiary) return;

    const viaCircular = await this.prisma.circularAttachment.findFirst({
      where: {
        fileId,
        circular: { recipients: { some: { userId: user.id } } },
      },
    });
    if (viaCircular) return;

    // Same visibility as the complaint itself: their child, raised by them or recorded by staff.
    const viaComplaint = await this.prisma.complaintAttachment.findFirst({
      where: {
        fileId,
        complaint: {
          student: {
            parents: { some: { parentProfile: { userId: user.id } } },
          },
          OR: [
            { raisedById: user.id },
            { raisedBy: { role: { not: 'PARENT' } } },
          ],
        },
      },
    });
    if (viaComplaint) return;

    throw new ForbiddenException('You do not have access to this file');
  }

  /** Every school/campus a file is attached to, through each kind of owning record. */
  private async homesOf(fileId: string): Promise<FileHome[]> {
    const studentCampuses = {
      select: { enrollments: { select: { campus: CAMPUS } } },
    } as const;
    const f = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        diaryAttachments: {
          select: {
            diaryEntry: {
              select: {
                section: { select: { class: { select: { campus: CAMPUS } } } },
              },
            },
          },
        },
        circularAttachments: {
          select: {
            circular: {
              select: {
                schoolId: true,
                section: { select: { class: { select: { campus: CAMPUS } } } },
              },
            },
          },
        },
        complaintAttachments: {
          select: {
            complaint: {
              select: { schoolId: true, student: studentCampuses },
            },
          },
        },
        reportCard: { select: { student: studentCampuses } },
        studentProfilePhotos: studentCampuses,
        studentDocuments: { select: { student: studentCampuses } },
        staffProfilePhotos: { select: { campus: CAMPUS } },
        staffDocuments: { select: { staff: { select: { campus: CAMPUS } } } },
        hiringCandidateResumes: {
          select: { applications: { select: { campus: CAMPUS } } },
        },
        schoolLogos: { select: { id: true } },
        campusLogos: CAMPUS,
      },
    });
    if (!f) return [];
    const homes: FileHome[] = [];
    const campus = (c: { id: string; schoolId: string }) =>
      homes.push({ schoolId: c.schoolId, campusId: c.id });
    const student = (s: {
      enrollments: Array<{ campus: { id: string; schoolId: string } }>;
    }) => s.enrollments.forEach((e) => campus(e.campus));

    f.diaryAttachments.forEach((a) =>
      campus(a.diaryEntry.section.class.campus),
    );
    for (const a of f.circularAttachments) {
      if (a.circular.section) campus(a.circular.section.class.campus);
      else if (a.circular.schoolId)
        homes.push({ schoolId: a.circular.schoolId, campusId: null });
    }
    for (const a of f.complaintAttachments) {
      if (a.complaint.schoolId) {
        homes.push({ schoolId: a.complaint.schoolId, campusId: null });
      }
      student(a.complaint.student);
    }
    if (f.reportCard) student(f.reportCard.student);
    f.studentProfilePhotos.forEach(student);
    f.studentDocuments.forEach((d) => student(d.student));
    f.staffProfilePhotos.forEach((s) => campus(s.campus));
    f.staffDocuments.forEach((d) => campus(d.staff.campus));
    f.hiringCandidateResumes.forEach((c) =>
      c.applications.forEach((a) => campus(a.campus)),
    );
    f.schoolLogos.forEach((s) =>
      homes.push({ schoolId: s.id, campusId: null }),
    );
    f.campusLogos.forEach(campus);
    return homes;
  }
}
