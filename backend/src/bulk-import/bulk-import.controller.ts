// backend/src/bulk-import/bulk-import.controller.ts
import { BadRequestException, Controller, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentsBulkImportService } from './students-bulk-import.service';
import { ParentsBulkImportService } from './parents-bulk-import.service';
import { TeachersBulkImportService } from './teachers-bulk-import.service';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

const CSV_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — far more than 2,000 rows of plain text needs
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      callback(new BadRequestException('Only .csv files are accepted.'), false);
      return;
    }
    callback(null, true);
  },
};

@Controller('api/v1/bulk-import')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class BulkImportController {
  constructor(
    private readonly studentsService: StudentsBulkImportService,
    private readonly parentsService: ParentsBulkImportService,
    private readonly teachersService: TeachersBulkImportService,
  ) {}

  @Post('students/preview')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  previewStudents(@UploadedFile() file: Express.Multer.File) {
    return this.studentsService.preview(file.buffer);
  }

  @Post('students/commit')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  async commitStudents(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    try {
      return await this.studentsService.commit(file.buffer, req.user.id);
    } catch (error) {
      if (error instanceof Error && 'rows' in error) {
        throw new BadRequestException({ message: error.message, rows: (error as Error & { rows: unknown }).rows });
      }
      throw error;
    }
  }

  @Post('parents/preview')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  previewParents(@UploadedFile() file: Express.Multer.File) {
    return this.parentsService.preview(file.buffer);
  }

  @Post('parents/commit')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  async commitParents(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    try {
      return await this.parentsService.commit(file.buffer, req.user.id);
    } catch (error) {
      if (error instanceof Error && 'rows' in error) {
        throw new BadRequestException({ message: error.message, rows: (error as Error & { rows: unknown }).rows });
      }
      throw error;
    }
  }

  @Post('teachers/preview')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  previewTeachers(@UploadedFile() file: Express.Multer.File) {
    return this.teachersService.preview(file.buffer);
  }

  @Post('teachers/commit')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  async commitTeachers(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    try {
      return await this.teachersService.commit(file.buffer, req.user.id);
    } catch (error) {
      if (error instanceof Error && 'rows' in error) {
        throw new BadRequestException({ message: error.message, rows: (error as Error & { rows: unknown }).rows });
      }
      throw error;
    }
  }
}
