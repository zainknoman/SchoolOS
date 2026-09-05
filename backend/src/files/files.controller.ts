import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { FilesAccessService } from './files-access.service';
import { RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

// 10 MB — generous for a diary/circular/message attachment (a worksheet scan, a PDF, a photo)
// while still bounding per-upload memory/disk usage. No spec value exists for this; chosen as a
// sane MVP default, easy to raise later if a real use case needs it.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Executable/script extensions have no legitimate use as a diary/circular/message attachment in
// this app; blocked regardless of the client-reported mimetype (which is attacker-controlled).
// Deliberately a blocklist, not an allowlist: staff also attach plain-text worksheets, images,
// PDFs, and office docs, none of which should need enumerating up front.
const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.dll',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.jar',
  '.sh',
  '.app',
]);

@Controller('api/v1/files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly filesAccess: FilesAccessService,
  ) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        if (BLOCKED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
          callback(
            new BadRequestException('This file type is not allowed.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.filesService.upload(file, req.user.id);
  }

  @Get(':id')
  async download(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    await this.filesAccess.assertCanAccessFile(req.user, id);
    const { buffer, originalName, mimeType } = await this.filesService.read(id);
    // Serve as a forced download (not inline) so an attacker-controlled mimetype/filename
    // (e.g. a .html file declared as text/html) can never render as a page on this origin —
    // which matters here because download links carry the caller's JWT via ?access_token=.
    // Strip quotes from the filename to prevent header injection via Content-Disposition.
    const safeName = originalName.replace(/"/g, '');
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(buffer);
  }
}
