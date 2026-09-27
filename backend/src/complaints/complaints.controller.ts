import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import {
  AddComplaintNoteDto,
  UpdateComplaintDto,
} from './dto/complaint-workflow.dto';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresGrant } from '../auth/decorators/requires-grant.decorator';
import { MAX_UPLOAD_BYTES } from '../files/files.controller';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

/**
 * BL-30 (Q10, RD-9): parents raise complaints about their own children; staff of the student's
 * school work them through the queue. Every write checks the caller's access to the complaint's
 * student first (KG-29: status updates used to be unchecked).
 */
@Controller('api/v1/complaints')
@RequiresGrant('COMPLAINTS')
export class ComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Post()
  async create(
    @Body() dto: CreateComplaintDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, dto.studentId);
    return this.complaintsService.create(dto, req.user);
  }

  // Staff see the student's complaints; a parent sees the ones they raised and those staff recorded.
  @Get()
  async findForStudent(
    @Query('studentId') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!studentId) {
      throw new BadRequestException('studentId is required');
    }
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.complaintsService.findForStudent(studentId, req.user);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get('queue')
  queue(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('assigned') assigned?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.complaintsService.queue(req.user, {
      status: status || undefined,
      category: category || undefined,
      assigned: assigned || undefined,
      schoolId: schoolId || undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const c = await this.complaintsService.getForUser(id, req.user);
    return this.complaintsService.view(c, req.user);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get(':id/assignees')
  async assignees(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const c = await this.complaintsService.getForUser(id, req.user);
    return this.complaintsService.assignees(c);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const c = await this.complaintsService.getForUser(id, req.user);
    return this.complaintsService.update(c, dto, req.user);
  }

  @Roles('PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Post(':id/notes')
  async addNote(
    @Param('id') id: string,
    @Body() dto: AddComplaintNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const c = await this.complaintsService.getForUser(id, req.user);
    return this.complaintsService.addNote(c, dto, req.user);
  }

  @Roles('PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async attach(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Attach a file');
    const c = await this.complaintsService.getForUser(id, req.user);
    // A parent adds files only to a complaint they raised.
    if (req.user.role === 'PARENT' && c.raisedById !== req.user.id) {
      throw new ForbiddenException(
        'You can only add files to your own complaint',
      );
    }
    return this.complaintsService.attach(c, file, req.user);
  }
}
