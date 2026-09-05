import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { createParentWithUser } from '../parent/create-parent-with-user';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

export interface StudentAdminSummary {
  id: string;
  grNumber: string;
  name: string;
  sectionName: string | null;
  className: string | null;
  campusName: string | null;
  parentNames: string[];
}

const WITH_SECTION_AND_PARENTS = {
  enrollments: {
    where: { status: 'ACTIVE' as const },
    orderBy: { startDate: 'desc' as const },
    take: 1,
    include: { section: { include: { class: { include: { campus: true } } } } },
  },
  parents: { include: { parentProfile: { select: { name: true } } } },
};

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    grNumber: string;
    name: string;
    enrollments: Array<{ section: { name: string; class: { name: string; campus: { name: string } } } }>;
    parents: Array<{ parentProfile: { name: string } }>;
  }): StudentAdminSummary {
    const enrollment = record.enrollments[0];
    return {
      id: record.id,
      grNumber: record.grNumber,
      name: record.name,
      sectionName: enrollment?.section.name ?? null,
      className: enrollment?.section.class.name ?? null,
      campusName: enrollment?.section.class.campus.name ?? null,
      parentNames: record.parents.map((p) => p.parentProfile.name),
    };
  }

  async create(dto: CreateStudentDto, actingUserId: string): Promise<StudentAdminSummary> {
    // `!= null` (not `!== undefined`) so an explicit `null` is treated the same as an omitted
    // field — otherwise `{ parentProfileId: null, newParent: null }` (or a null/omitted mix)
    // slips past this guard and blows up downstream instead of getting a clean 400 here.
    const hasExisting = dto.parentProfileId != null;
    const hasNew = dto.newParent != null;
    if (hasExisting === hasNew) {
      // Both true (both given) or both false (neither given) are the two invalid states.
      throw new BadRequestException('Provide exactly one of parentProfileId or newParent');
    }

    const activeSession = await this.prisma.academicSession.findFirst({ where: { isActive: true } });
    if (!activeSession) {
      throw new BadRequestException('No active academic session — cannot enroll a student');
    }
    const section = await this.prisma.section.findUnique({
      where: { id: dto.sectionId },
      select: { id: true, class: { select: { campusId: true } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    let studentId: string;
    try {
      studentId = await this.prisma.$transaction(async (tx) => {
        const student = await tx.student.create({ data: { grNumber: dto.grNumber, name: dto.name } });
        await tx.enrollment.create({
          data: {
            studentId: student.id,
            campusId: section.class.campusId,
            sectionId: section.id,
            academicSessionId: activeSession.id,
            startDate: new Date(),
            status: 'ACTIVE',
          },
        });
        let parentProfileId: string;
        if (hasExisting) {
          const parent = await tx.parentProfile.findUnique({ where: { id: dto.parentProfileId! } });
          if (!parent) {
            throw new BadRequestException('Parent not found');
          }
          parentProfileId = parent.id;
        } else {
          const newParent = await createParentWithUser(tx, dto.newParent!);
          parentProfileId = newParent.id;
          // Mirrors ParentService.create()'s audit-log convention: the inline "+ New Parent"
          // branch provisions a real Parent/User account, so it gets its own parent.create row
          // (never the raw password), on top of the student.create row below — same transaction.
          await tx.auditLog.create({
            data: {
              userId: actingUserId,
              action: 'parent.create',
              entity: 'ParentProfile',
              entityId: newParent.id,
              metadata: JSON.stringify({ identifier: dto.newParent!.identifier, name: dto.newParent!.name }),
            },
          });
        }
        await tx.studentParent.create({ data: { studentId: student.id, parentProfileId } });
        await tx.auditLog.create({
          data: {
            userId: actingUserId,
            action: 'student.create',
            entity: 'Student',
            entityId: student.id,
            metadata: JSON.stringify({ grNumber: dto.grNumber, name: dto.name, sectionId: dto.sectionId }),
          },
        });
        return student.id;
      });
    } catch (error) {
      assertCreatable(error, 'This GR number or parent identifier is already in use.');
    }

    const created = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: WITH_SECTION_AND_PARENTS,
    });
    return this.toSummary(created);
  }

  async list(): Promise<StudentAdminSummary[]> {
    const records = await this.prisma.student.findMany({
      include: WITH_SECTION_AND_PARENTS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateStudentDto, actingUserId: string): Promise<StudentAdminSummary> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    const record = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.grNumber !== undefined ? { grNumber: dto.grNumber } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
      include: WITH_SECTION_AND_PARENTS,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.update',
        entity: 'Student',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    try {
      await this.prisma.student.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Student');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'student.delete', entity: 'Student', entityId: id },
    });
  }
}
