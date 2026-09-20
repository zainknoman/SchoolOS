import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import type { UpdateChildDto } from './dto/update-child.dto';

export interface ChildDetail {
  id: string;
  name: string;
  grNumber: string;
  gender: string | null;
  dateOfBirth: string | null;
  admissionDate: string | null;
  status: string;
  campus: string | null;
  class: string | null;
  section: string | null;
  rollNumber: string | null;
  studentMobile: string | null;
  studentEmail: string | null;
  currentAddress: {
    line1: string;
    line2: string | null;
    area: string | null;
    city: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
  } | null;
  medical: {
    bloodGroup: string | null;
    allergies: string | null;
    medicalConditions: string | null;
    medicationNotes: string | null;
  };
  emergencyContacts: {
    name: string;
    relationship: string;
    phone: string;
    alternatePhone: string | null;
  }[];
  guardians: { name: string; relationship: string; phone: string | null }[];
}

export interface ChildSummary {
  id: string;
  name: string;
  grNumber: string;
  campus: string;
  class: string;
  section: string;
  /** The logged-in parent's StudentParent.relationship to this child ("mother", "father", "guardian", …) — the parent-app uses it to pick its per-guardian accent colour. */
  relationship: string;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws unless [studentId] is linked to this user's ParentProfile — the parent-side access gate. */
  private async assertChildLinked(
    userId: string,
    studentId: string,
  ): Promise<void> {
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, parentProfile: { userId } },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException('Child not found');
    }
  }

  async getChildDetail(
    userId: string,
    studentId: string,
  ): Promise<ChildDetail> {
    await this.assertChildLinked(userId, studentId);
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: {
        currentAddress: true,
        medicalInfo: true,
        emergencyContacts: { orderBy: { priority: 'asc' } },
        parents: {
          include: { parentProfile: { select: { name: true, phone: true } } },
        },
        enrollments: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          take: 1,
          include: { campus: true, section: { include: { class: true } } },
        },
      },
    });
    const enrollment = student.enrollments[0];
    const address = student.currentAddress;
    return {
      id: student.id,
      name: student.name,
      grNumber: student.grNumber,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      admissionDate: student.admissionDate?.toISOString().slice(0, 10) ?? null,
      status: student.status,
      campus: enrollment?.campus.name ?? null,
      class: enrollment?.section.class.name ?? null,
      section: enrollment?.section.name ?? null,
      rollNumber: enrollment?.rollNumber ?? null,
      studentMobile: student.studentMobile,
      studentEmail: student.studentEmail,
      currentAddress: address
        ? {
            line1: address.line1,
            line2: address.line2,
            area: address.area,
            city: address.city,
            district: address.district,
            province: address.province,
            postalCode: address.postalCode,
            country: address.country,
          }
        : null,
      medical: {
        bloodGroup: student.medicalInfo?.bloodGroup ?? null,
        allergies: student.medicalInfo?.allergies ?? null,
        medicalConditions: student.medicalInfo?.medicalConditions ?? null,
        medicationNotes: student.medicalInfo?.medicationNotes ?? null,
      },
      emergencyContacts: student.emergencyContacts.map((c) => ({
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        alternatePhone: c.alternatePhone,
      })),
      guardians: student.parents.map((p) => ({
        name: p.parentProfile.name,
        relationship: p.relationship,
        phone: p.parentProfile.phone,
      })),
    };
  }

  /**
   * Parent-editable subset of a child's profile (contact details, current address, emergency
   * contacts, and the free-text medical notes). Everything else about the student stays admin-only.
   */
  async updateChild(
    userId: string,
    studentId: string,
    dto: UpdateChildDto,
  ): Promise<ChildDetail> {
    await this.assertChildLinked(userId, studentId);
    await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        select: { currentAddressId: true },
      });

      const data: Prisma.StudentUpdateInput = {};
      if (dto.studentMobile !== undefined)
        data.studentMobile = dto.studentMobile || null;
      if (dto.studentEmail !== undefined)
        data.studentEmail = dto.studentEmail || null;
      if (dto.currentAddress) {
        data.currentAddress = student.currentAddressId
          ? { update: dto.currentAddress }
          : { create: dto.currentAddress };
      }
      if (Object.keys(data).length > 0) {
        await tx.student.update({ where: { id: studentId }, data });
      }

      const medical: Prisma.StudentMedicalInfoUpdateInput = {};
      if (dto.allergies !== undefined)
        medical.allergies = dto.allergies || null;
      if (dto.medicalConditions !== undefined)
        medical.medicalConditions = dto.medicalConditions || null;
      if (dto.medicationNotes !== undefined)
        medical.medicationNotes = dto.medicationNotes || null;
      if (Object.keys(medical).length > 0) {
        await tx.studentMedicalInfo.upsert({
          where: { studentId },
          create: {
            studentId,
            ...medical,
          } as Prisma.StudentMedicalInfoUncheckedCreateInput,
          update: medical,
        });
      }

      if (dto.emergencyContacts) {
        await tx.studentEmergencyContact.deleteMany({ where: { studentId } });
        if (dto.emergencyContacts.length > 0) {
          await tx.studentEmergencyContact.createMany({
            data: dto.emergencyContacts.map((c, i) => ({
              studentId,
              name: c.name,
              relationship: c.relationship,
              phone: c.phone,
              alternatePhone: c.alternatePhone || null,
              priority: i + 1,
              isPrimary: i === 0,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'parent.child.update',
          entity: 'Student',
          entityId: studentId,
          metadata: JSON.stringify({ fields: Object.keys(dto) }),
        },
      });
    });
    return this.getChildDetail(userId, studentId);
  }

  /**
   * Only ever returns students linked to THIS parent's profile (via StudentParent) — a parent can
   * never fetch a child they are not linked to, because the query is scoped by userId, not by an
   * open student/campus filter the caller could widen.
   */
  async getChildrenForUser(userId: string): Promise<ChildSummary[]> {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId },
      include: {
        children: {
          include: {
            student: {
              include: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                  orderBy: { startDate: 'desc' },
                  take: 1,
                  include: {
                    campus: true,
                    section: { include: { class: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parentProfile) {
      return [];
    }

    return parentProfile.children.map(({ student, relationship }) => {
      const enrollment = student.enrollments[0];
      return {
        id: student.id,
        name: student.name,
        grNumber: student.grNumber,
        campus: enrollment.campus.name,
        class: enrollment.section.class.name,
        section: enrollment.section.name,
        relationship,
      };
    });
  }

  /**
   * Upsert by token (not userId+token) — a device token is unique per install, and if the same
   * device logs out and a different user logs back in on it, the token must move to the new
   * user, not create a stale duplicate row still pointing at the old one.
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  /**
   * Partial update — only the fields present in the DTO are written, so a client can flip just
   * the channel or just the digest checkbox without needing to resend the other. The no-op
   * behavior for a channel with no resolvable destination (e.g. WHATSAPP with no ParentProfile
   * phone) lives in the adapter, not here — this write always succeeds.
   */
  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.channel !== undefined && { notificationChannel: dto.channel }),
        ...(dto.digestEnabled !== undefined && {
          digestEnabled: dto.digestEnabled,
        }),
      },
    });
  }
}
