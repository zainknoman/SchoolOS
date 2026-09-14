import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateCurrentEnrollmentDto } from './dto/update-current-enrollment.dto';
import { UpdateStudentPreviousSchoolDto } from './dto/update-student-previous-school.dto';
import { CreateStudentEmergencyContactDto } from './dto/create-student-emergency-contact.dto';
import { UpdateStudentEmergencyContactDto } from './dto/update-student-emergency-contact.dto';
import { UpdateStudentMedicalInfoDto } from './dto/update-student-medical-info.dto';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';
import { AddressDto } from '../common/dto/address.dto';

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

  private addressWrite(address: AddressDto | undefined, existingAddressId: string | null | undefined) {
    if (!address) return undefined;
    return existingAddressId ? { update: address } : { create: address };
  }

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
      profilePhoto:
        dto.profilePhotoFileId !== undefined ? { connect: { id: dto.profilePhotoFileId } } : undefined,
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

    data.currentAddress = this.addressWrite(dto.currentAddress, existing.currentAddressId);
    data.permanentAddress = this.addressWrite(dto.permanentAddress, existing.permanentAddressId);

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
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
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
          address: this.addressWrite(dto.address, existing.addressId),
        },
        include: { address: true },
      });
    } else {
      record = await this.prisma.studentPreviousSchool.create({
        data: {
          student: { connect: { id: studentId } },
          ...scalarData,
          address: dto.address ? { create: dto.address } : undefined,
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

  async upsertMedicalInfo(studentId: string, dto: UpdateStudentMedicalInfoDto, actingUserId: string) {
    await this.requireStudent(studentId);
    const record = await this.prisma.studentMedicalInfo.upsert({
      where: { studentId },
      create: { studentId, ...dto },
      update: { ...dto },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.medicalInfo.upsert',
        entity: 'StudentMedicalInfo',
        entityId: record.id,
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
      },
    });
    return record;
  }

  async listEmergencyContacts(studentId: string) {
    await this.requireStudent(studentId);
    return this.prisma.studentEmergencyContact.findMany({
      where: { studentId },
      include: { address: true },
      orderBy: { priority: 'asc' },
    });
  }

  async createEmergencyContact(studentId: string, dto: CreateStudentEmergencyContactDto, actingUserId: string) {
    await this.requireStudent(studentId);
    const record = await this.prisma.studentEmergencyContact.create({
      data: {
        student: { connect: { id: studentId } },
        name: dto.name,
        relationship: dto.relationship,
        phone: dto.phone,
        alternatePhone: dto.alternatePhone,
        email: dto.email,
        priority: dto.priority ?? 1,
        isPrimary: dto.isPrimary ?? false,
        address: dto.address ? { create: dto.address } : undefined,
      },
      include: { address: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.emergencyContact.create',
        entity: 'StudentEmergencyContact',
        entityId: record.id,
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
      },
    });
    return record;
  }

  async updateEmergencyContact(
    studentId: string,
    contactId: string,
    dto: UpdateStudentEmergencyContactDto,
    actingUserId: string,
  ) {
    const existing = await this.prisma.studentEmergencyContact.findUnique({ where: { id: contactId } });
    if (!existing || existing.studentId !== studentId) {
      throw new NotFoundException('Emergency contact not found');
    }

    const record = await this.prisma.studentEmergencyContact.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.relationship !== undefined ? { relationship: dto.relationship } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.alternatePhone !== undefined ? { alternatePhone: dto.alternatePhone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        address: this.addressWrite(dto.address, existing.addressId),
      },
      include: { address: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.emergencyContact.update',
        entity: 'StudentEmergencyContact',
        entityId: contactId,
        metadata: JSON.stringify(dto),
      },
    });
    return record;
  }

  async deleteEmergencyContact(studentId: string, contactId: string, actingUserId: string) {
    const existing = await this.prisma.studentEmergencyContact.findUnique({ where: { id: contactId } });
    if (!existing || existing.studentId !== studentId) {
      throw new NotFoundException('Emergency contact not found');
    }
    await this.prisma.studentEmergencyContact.delete({ where: { id: contactId } });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.emergencyContact.delete',
        entity: 'StudentEmergencyContact',
        entityId: contactId,
      },
    });
  }

  async listDocuments(studentId: string) {
    await this.requireStudent(studentId);
    return this.prisma.studentDocument.findMany({
      where: { studentId },
      include: { file: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDocument(studentId: string, dto: CreateStudentDocumentDto, actingUserId: string) {
    await this.requireStudent(studentId);
    const file = await this.prisma.file.findUnique({ where: { id: dto.fileId } });
    if (!file) {
      throw new BadRequestException('Upload the file first via POST /api/v1/files, then link it here.');
    }
    const record = await this.prisma.studentDocument.create({
      data: {
        studentId,
        documentType: dto.documentType,
        fileId: dto.fileId,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        notes: dto.notes,
      },
      include: { file: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.document.add',
        entity: 'StudentDocument',
        entityId: record.id,
        metadata: JSON.stringify({ documentType: dto.documentType, fileId: dto.fileId }),
      },
    });
    return record;
  }

  async verifyDocument(studentId: string, documentId: string, verified: boolean, actingUserId: string) {
    const existing = await this.prisma.studentDocument.findUnique({ where: { id: documentId } });
    if (!existing || existing.studentId !== studentId) {
      throw new NotFoundException('Document not found');
    }
    const record = await this.prisma.studentDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: verified ? 'VERIFIED' : 'REJECTED',
        verifiedById: actingUserId,
        verifiedAt: new Date(),
      },
      include: { file: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.document.verify',
        entity: 'StudentDocument',
        entityId: documentId,
        metadata: JSON.stringify({ verified }),
      },
    });
    return record;
  }
}
