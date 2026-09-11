import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { ReportCardsService } from './report-cards.service';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentAccessService, RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MAX_UPLOAD_BYTES } from '../files/files.controller';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/report-cards')
export class ReportCardsController {
  constructor(
    private readonly reportCardsService: ReportCardsService,
    private readonly filesService: FilesService,
    private readonly prisma: PrismaService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    const studentId = req.body.studentId as string;
    const academicSessionId = req.body.academicSessionId as string;
    if (!studentId || !academicSessionId) {
      throw new BadRequestException('studentId and academicSessionId are required');
    }
    return this.reportCardsService.upload(studentId, academicSessionId, file, req.user.id);
  }

  @Get()
  async findForStudent(@Query('studentId') studentId: string, @Req() req: AuthenticatedRequest) {
    if (!studentId) {
      throw new BadRequestException('studentId is required');
    }
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.reportCardsService.findForStudent(studentId);
  }

  @Get(':id/pdf')
  async download(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const record = await this.prisma.reportCard.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('Report card not found');
    }
    await this.studentAccess.assertCanAccessStudent(req.user, record.studentId);
    const { buffer, originalName, mimeType } = await this.filesService.read(record.fileId);
    const safeName = originalName.replace(/"/g, '');
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(buffer);
  }
}
