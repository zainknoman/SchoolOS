import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecordScopeGuard, ScopedRecord } from '../common/record-scope.guard';
import type { Request } from 'express';
import { StudentProfileService } from './student-profile.service';
import { PromotionsService } from '../promotions/promotions.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateCurrentEnrollmentDto } from './dto/update-current-enrollment.dto';
import { UpdateStudentPreviousSchoolDto } from './dto/update-student-previous-school.dto';
import { CreateStudentEmergencyContactDto } from './dto/create-student-emergency-contact.dto';
import { UpdateStudentEmergencyContactDto } from './dto/update-student-emergency-contact.dto';
import { UpdateStudentMedicalInfoDto } from './dto/update-student-medical-info.dto';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';
import { VerifyStudentDocumentDto } from './dto/verify-student-document.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/students/:studentId')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
@UseGuards(RecordScopeGuard)
@ScopedRecord('student', 'studentId')
export class StudentProfileController {
  constructor(
    private readonly service: StudentProfileService,
    private readonly promotionsService: PromotionsService,
  ) {}

  @Get('profile')
  getProfile(@Param('studentId') studentId: string) {
    return this.service.getProfile(studentId);
  }

  @Patch('profile')
  updateProfile(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateProfile(studentId, dto, req.user.id);
  }

  @Patch('current-enrollment')
  updateCurrentEnrollment(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateCurrentEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateCurrentEnrollment(studentId, dto, req.user.id);
  }

  @Put('previous-school')
  upsertPreviousSchool(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentPreviousSchoolDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.upsertPreviousSchool(studentId, dto, req.user.id);
  }

  @Put('medical-info')
  upsertMedicalInfo(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentMedicalInfoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.upsertMedicalInfo(studentId, dto, req.user.id);
  }

  @Get('emergency-contacts')
  listEmergencyContacts(@Param('studentId') studentId: string) {
    return this.service.listEmergencyContacts(studentId);
  }

  @Post('emergency-contacts')
  createEmergencyContact(
    @Param('studentId') studentId: string,
    @Body() dto: CreateStudentEmergencyContactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createEmergencyContact(studentId, dto, req.user.id);
  }

  @Patch('emergency-contacts/:contactId')
  updateEmergencyContact(
    @Param('studentId') studentId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateStudentEmergencyContactDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateEmergencyContact(
      studentId,
      contactId,
      dto,
      req.user.id,
    );
  }

  @Delete('emergency-contacts/:contactId')
  async deleteEmergencyContact(
    @Param('studentId') studentId: string,
    @Param('contactId') contactId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.service.deleteEmergencyContact(
      studentId,
      contactId,
      req.user.id,
    );
  }

  @Get('documents')
  listDocuments(@Param('studentId') studentId: string) {
    return this.service.listDocuments(studentId);
  }

  @Post('documents')
  addDocument(
    @Param('studentId') studentId: string,
    @Body() dto: CreateStudentDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addDocument(studentId, dto, req.user.id);
  }

  @Patch('documents/:documentId/verify')
  verifyDocument(
    @Param('studentId') studentId: string,
    @Param('documentId') documentId: string,
    @Body() dto: VerifyStudentDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.verifyDocument(
      studentId,
      documentId,
      dto.verified,
      req.user.id,
    );
  }

  @Get('promotion-history')
  getPromotionHistory(@Param('studentId') studentId: string) {
    return this.promotionsService.getPromotionHistory(studentId);
  }
}
