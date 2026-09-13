import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateCurrentEnrollmentDto } from './dto/update-current-enrollment.dto';
import { UpdateStudentPreviousSchoolDto } from './dto/update-student-previous-school.dto';

export const PROFILE_INCLUDE = {
  currentAddress: true,
  permanentAddress: true,
  previousSchool: { include: { address: true } },
  emergencyContacts: { include: { address: true }, orderBy: { priority: 'asc' as const } },
  medicalInfo: true,
  documents: { include: { file: true }, orderBy: { createdAt: 'desc' as const } },
  enrollments: {
    where: { status: 'ACTIVE' as const },
    orderBy: { startDate: 'desc' as const },
    take: 1,
    include: { section: { include: { class: { include: { campus: true } } } } },
  },
};

@Injectable()
export class StudentProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async getProfile(studentId: string) {
    await this.requireStudent(studentId);
    return this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: PROFILE_INCLUDE });
  }

  async updateProfile(studentId: string, dto: UpdateStudentProfileDto, actingUserId: string) {
    const existing = await this.requireStudent(studentId);

    if (dto.profilePhotoFileId !== undefined) {
      const file = await this.prisma.file.findUnique({ where: { id: dto.profilePhotoFileId } });
      if (!file) {
        throw new BadRequestException('Upload the photo first via POST /api/v1/files, then link it here.');
      }
    }

    const data: Prisma.StudentUpdateInput = {
      ...(dto.profilePhotoFileId !== undefined ? { profilePhotoFileId: dto.profilePhotoFileId } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.middleName !== undefined ? { middleName: dto.middleName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.preferredName !== undefined ? { preferredName: dto.preferredName } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      ...(dto.placeOfBirth !== undefined ? { placeOfBirth: dto.placeOfBirth } : {}),
      ...(dto.nationality !== undefined ? { nationality: dto.nationality } : {}),
      ...(dto.religion !== undefined ? { religion: dto.religion } : {}),
      ...(dto.bFormNumber !== undefined ? { bFormNumber: dto.bFormNumber } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.admissionDate !== undefined ? { admissionDate: new Date(dto.admissionDate) } : {}),
      ...(dto.leavingDate !== undefined ? { leavingDate: new Date(dto.leavingDate) } : {}),
      ...(dto.leavingReason !== undefined ? { leavingReason: dto.leavingReason } : {}),
      ...(dto.studentMobile !== undefined ? { studentMobile: dto.studentMobile } : {}),
      ...(dto.studentEmail !== undefined ? { studentEmail: dto.studentEmail } : {}),
    };

    if (dto.currentAddress) {
      data.currentAddress = existing.currentAddressId
        ? { update: dto.currentAddress }
        : { create: dto.currentAddress };
    }
    if (dto.permanentAddress) {
      data.permanentAddress = existing.permanentAddressId
        ? { update: dto.permanentAddress }
        : { create: dto.permanentAddress };
    }

    let record;
    try {
      record = await this.prisma.student.update({ where: { id: studentId }, data, include: PROFILE_INCLUDE });
    } catch (error) {
      assertCreatable(error, 'This B-Form number is already in use.');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.profile.update',
        entity: 'Student',
        entityId: studentId,
        metadata: JSON.stringify(dto),
      },
    });

    return record;
  }

  async updateCurrentEnrollment(studentId: string, dto: UpdateCurrentEnrollmentDto, actingUserId: string) {
    await this.requireStudent(studentId);

    const active = await this.prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });
    if (!active) {
      throw new NotFoundException('This student has no active enrollment');
    }

    const record = await this.prisma.enrollment.update({
      where: { id: active.id },
      data: {
        ...(dto.rollNumber !== undefined ? { rollNumber: dto.rollNumber } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.enrollment.update',
        entity: 'Enrollment',
        entityId: active.id,
        metadata: JSON.stringify(dto),
      },
    });

    return record;
  }

  async upsertPreviousSchool(studentId: string, dto: UpdateStudentPreviousSchoolDto, actingUserId: string) {
    await this.requireStudent(studentId);

    const scalarData = {
      schoolName: dto.schoolName,
      contactNumber: dto.contactNumber,
      email: dto.email,
      lastClassAttended: dto.lastClassAttended,
      admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : undefined,
      leavingDate: dto.leavingDate ? new Date(dto.leavingDate) : undefined,
      leavingCertificateNumber: dto.leavingCertificateNumber,
      leavingCertificateDate: dto.leavingCertificateDate ? new Date(dto.leavingCertificateDate) : undefined,
      reasonForLeaving: dto.reasonForLeaving,
      academicRemarks: dto.academicRemarks,
    };

    const existing = await this.prisma.studentPreviousSchool.findUnique({ where: { studentId } });

    let record;
    if (existing) {
      record = await this.prisma.studentPreviousSchool.update({
        where: { studentId },
        data: {
          ...scalarData,
          ...(dto.address
            ? { address: existing.addressId ? { update: dto.address } : { create: dto.address } }
            : {}),
        },
        include: { address: true },
      });
    } else {
      record = await this.prisma.studentPreviousSchool.create({
        data: {
          studentId,
          ...scalarData,
          ...(dto.address ? { address: { create: dto.address } } : {}),
        },
        include: { address: true },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.previousSchool.upsert',
        entity: 'StudentPreviousSchool',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });

    return record;
  }
}
