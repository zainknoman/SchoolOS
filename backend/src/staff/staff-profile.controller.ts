import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  Delete,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffProfileService } from './staff-profile.service';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateStaffEmergencyContactDto } from './dto/create-staff-emergency-contact.dto';
import { UpdateStaffEmergencyContactDto } from './dto/update-staff-emergency-contact.dto';
import { CreateStaffExperienceDto } from './dto/create-staff-experience.dto';
import { UpdateStaffExperienceDto } from './dto/update-staff-experience.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RecordScopeGuard, ScopedRecord } from '../common/record-scope.guard';
import type { RequestUser } from '../common/student-access.service';
import { CreateStaffDocumentDto } from './dto/create-staff-document.dto';
import { VerifyStaffDocumentDto } from './dto/verify-staff-document.dto';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/staff/:staffId')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
@UseGuards(RecordScopeGuard)
@ScopedRecord('staff', 'staffId')
export class StaffProfileController {
  constructor(private readonly service: StaffProfileService) {}

  @Get('profile')
  getProfile(@Param('staffId') staffId: string) {
    return this.service.getProfile(staffId);
  }

  @Patch('profile')
  updateProfile(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateProfile(staffId, dto, req.user.id);
  }

  @Get('emergency-contacts')
  listEmergencyContacts(@Param('staffId') staffId: string) {
    return this.service.listEmergencyContacts(staffId);
  }

  @Post('emergency-contacts')
  createEmergencyContact(
    @Param('staffId') staffId: string,
    @Body() dto: CreateStaffEmergencyContactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createEmergencyContact(staffId, dto, req.user.id);
  }

  @Patch('emergency-contacts/:contactId')
  updateEmergencyContact(
    @Param('staffId') staffId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateStaffEmergencyContactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateEmergencyContact(
      staffId,
      contactId,
      dto,
      req.user.id,
    );
  }

  @Delete('emergency-contacts/:contactId')
  async deleteEmergencyContact(
    @Param('staffId') staffId: string,
    @Param('contactId') contactId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.service.deleteEmergencyContact(staffId, contactId, req.user.id);
  }

  @Get('experience')
  listExperience(@Param('staffId') staffId: string) {
    return this.service.listExperience(staffId);
  }

  @Post('experience')
  createExperience(
    @Param('staffId') staffId: string,
    @Body() dto: CreateStaffExperienceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createExperience(staffId, dto, req.user.id);
  }

  @Patch('experience/:experienceId')
  updateExperience(
    @Param('staffId') staffId: string,
    @Param('experienceId') experienceId: string,
    @Body() dto: UpdateStaffExperienceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateExperience(
      staffId,
      experienceId,
      dto,
      req.user.id,
    );
  }

  @Delete('experience/:experienceId')
  async deleteExperience(
    @Param('staffId') staffId: string,
    @Param('experienceId') experienceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.service.deleteExperience(staffId, experienceId, req.user.id);
  }

  @Get('documents')
  listDocuments(@Param('staffId') staffId: string) {
    return this.service.listDocuments(staffId);
  }

  @Post('documents')
  addDocument(
    @Param('staffId') staffId: string,
    @Body() dto: CreateStaffDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addDocument(staffId, dto, req.user.id);
  }

  @Patch('documents/:documentId/verify')
  verifyDocument(
    @Param('staffId') staffId: string,
    @Param('documentId') documentId: string,
    @Body() dto: VerifyStaffDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.verifyDocument(
      staffId,
      documentId,
      dto.verified,
      req.user.id,
    );
  }
}
