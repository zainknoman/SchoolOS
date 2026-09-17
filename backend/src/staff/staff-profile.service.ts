import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateStaffEmergencyContactDto } from './dto/create-staff-emergency-contact.dto';
import { UpdateStaffEmergencyContactDto } from './dto/update-staff-emergency-contact.dto';
import { CreateStaffExperienceDto } from './dto/create-staff-experience.dto';
import { UpdateStaffExperienceDto } from './dto/update-staff-experience.dto';
import { AddressDto } from '../common/dto/address.dto';
import { CreateStaffDocumentDto } from './dto/create-staff-document.dto';

export const STAFF_PROFILE_INCLUDE = {
  currentAddress: true,
  permanentAddress: true,
  teacher: { include: { user: { select: { identifier: true } } } },
  emergencyContacts: { include: { address: true }, orderBy: { priority: 'asc' as const } },
  experience: { orderBy: { fromDate: 'desc' as const } },
  documents: { include: { file: true }, orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class StaffProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private addressWrite(address: AddressDto | undefined, existingAddressId: string | null | undefined) {
    if (!address) return undefined;
    return existingAddressId ? { update: address } : { create: address };
  }

  private async requireStaff(staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    return staff;
  }

  async getProfile(staffId: string) {
    await this.requireStaff(staffId);
    return this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, include: STAFF_PROFILE_INCLUDE });
  }

  async updateProfile(staffId: string, dto: UpdateStaffProfileDto, actingUserId: string) {
    const existing = await this.requireStaff(staffId);

    if (dto.profilePhotoFileId !== undefined) {
      const file = await this.prisma.file.findUnique({ where: { id: dto.profilePhotoFileId } });
      if (!file) {
        throw new BadRequestException('Upload the photo first via POST /api/v1/files, then link it here.');
      }
    }

    const data: Prisma.StaffUpdateInput = {
      profilePhoto:
        dto.profilePhotoFileId !== undefined ? { connect: { id: dto.profilePhotoFileId } } : undefined,
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.middleName !== undefined ? { middleName: dto.middleName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      ...(dto.cnic !== undefined ? { cnic: dto.cnic } : {}),
      ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.joiningDate !== undefined ? { joiningDate: new Date(dto.joiningDate) } : {}),
      ...(dto.employmentStatus !== undefined ? { employmentStatus: dto.employmentStatus } : {}),
      ...(dto.leavingDate !== undefined ? { leavingDate: new Date(dto.leavingDate) } : {}),
      ...(dto.leavingReason !== undefined ? { leavingReason: dto.leavingReason } : {}),
    };

    data.currentAddress = this.addressWrite(dto.currentAddress, existing.currentAddressId);
    data.permanentAddress = this.addressWrite(dto.permanentAddress, existing.permanentAddressId);

    let record;
    try {
      record = await this.prisma.staff.update({ where: { id: staffId }, data, include: STAFF_PROFILE_INCLUDE });
    } catch (error) {
      assertCreatable(error, 'This CNIC is already in use.');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'staff.profile.update',
        entity: 'Staff',
        entityId: staffId,
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
      },
    });

    return record;
  }

  async listEmergencyContacts(staffId: string) {
    await this.requireStaff(staffId);
    return this.prisma.staffEmergencyContact.findMany({
      where: { staffId },
      include: { address: true },
      orderBy: { priority: 'asc' },
    });
  }

  async createEmergencyContact(staffId: string, dto: CreateStaffEmergencyContactDto, actingUserId: string) {
    await this.requireStaff(staffId);
    const record = await this.prisma.staffEmergencyContact.create({
      data: {
        staff: { connect: { id: staffId } },
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
        action: 'staff.emergencyContact.create',
        entity: 'StaffEmergencyContact',
        entityId: record.id,
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
      },
    });
    return record;
  }

  async updateEmergencyContact(
    staffId: string,
    contactId: string,
    dto: UpdateStaffEmergencyContactDto,
    actingUserId: string,
  ) {
    const existing = await this.prisma.staffEmergencyContact.findUnique({ where: { id: contactId } });
    if (!existing || existing.staffId !== staffId) {
      throw new NotFoundException('Emergency contact not found');
    }

    const record = await this.prisma.staffEmergencyContact.update({
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
        action: 'staff.emergencyContact.update',
        entity: 'StaffEmergencyContact',
        entityId: contactId,
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
      },
    });
    return record;
  }

  async deleteEmergencyContact(staffId: string, contactId: string, actingUserId: string) {
    const existing = await this.prisma.staffEmergencyContact.findUnique({ where: { id: contactId } });
    if (!existing || existing.staffId !== staffId) {
      throw new NotFoundException('Emergency contact not found');
    }
    await this.prisma.staffEmergencyContact.delete({ where: { id: contactId } });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'staff.emergencyContact.delete',
        entity: 'StaffEmergencyContact',
        entityId: contactId,
      },
    });
  }

  async listExperience(staffId: string) {
    await this.requireStaff(staffId);
    return this.prisma.staffExperience.findMany({ where: { staffId }, orderBy: { fromDate: 'desc' } });
  }

  async createExperience(staffId: string, dto: CreateStaffExperienceDto, actingUserId: string) {
    await this.requireStaff(staffId);
    const record = await this.prisma.staffExperience.create({
      data: {
        staffId,
        organization: dto.organization,
        role: dto.role,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        description: dto.description,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'staff.experience.create',
        entity: 'StaffExperience',
        entityId: record.id,
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
      },
    });
    return record;
  }

  async updateExperience(staffId: string, experienceId: string, dto: UpdateStaffExperienceDto, actingUserId: string) {
    const existing = await this.prisma.staffExperience.findUnique({ where: { id: experienceId } });
    if (!existing || existing.staffId !== staffId) {
      throw new NotFoundException('Experience entry not found');
    }
    const record = await this.prisma.staffExperience.update({
      where: { id: experienceId },
      data: {
        ...(dto.organization !== undefined ? { organization: dto.organization } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.fromDate !== undefined ? { fromDate: new Date(dto.fromDate) } : {}),
        ...(dto.toDate !== undefined ? { toDate: new Date(dto.toDate) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'staff.experience.update',
        entity: 'StaffExperience',
        entityId: experienceId,
        metadata: JSON.stringify({ fields: Object.keys(dto) }),
      },
    });
    return record;
  }

  async deleteExperience(staffId: string, experienceId: string, actingUserId: string) {
    const existing = await this.prisma.staffExperience.findUnique({ where: { id: experienceId } });
    if (!existing || existing.staffId !== staffId) {
      throw new NotFoundException('Experience entry not found');
    }
    await this.prisma.staffExperience.delete({ where: { id: experienceId } });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'staff.experience.delete',
        entity: 'StaffExperience',
        entityId: experienceId,
      },
    });
  }

  async listDocuments(staffId: string) {
    await this.requireStaff(staffId);
    return this.prisma.staffDocument.findMany({
      where: { staffId },
      include: { file: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDocument(staffId: string, dto: CreateStaffDocumentDto, actingUserId: string) {
    await this.requireStaff(staffId);
    const file = await this.prisma.file.findUnique({ where: { id: dto.fileId } });
    if (!file) {
      throw new BadRequestException('Upload the file first via POST /api/v1/files, then link it here.');
    }
    const record = await this.prisma.staffDocument.create({
      data: {
        staffId,
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
        action: 'staff.document.add',
        entity: 'StaffDocument',
        entityId: record.id,
        metadata: JSON.stringify({ documentType: dto.documentType, fileId: dto.fileId }),
      },
    });
    return record;
  }

  async verifyDocument(staffId: string, documentId: string, verified: boolean, actingUserId: string) {
    const existing = await this.prisma.staffDocument.findUnique({ where: { id: documentId } });
    if (!existing || existing.staffId !== staffId) {
      throw new NotFoundException('Document not found');
    }
    const record = await this.prisma.staffDocument.update({
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
        action: 'staff.document.verify',
        entity: 'StaffDocument',
        entityId: documentId,
        metadata: JSON.stringify({ verified }),
      },
    });
    return record;
  }
}