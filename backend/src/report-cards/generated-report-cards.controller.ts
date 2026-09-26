import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { GeneratedReportCardsService } from './generated-report-cards.service';
import { ReportCardPdfService } from './report-card-pdf.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

/** BL-06 (Q6): report cards generated from the gradebook — versioned, immutable, PDF. */
@Controller('api/v1/report-cards/generated')
export class GeneratedReportCardsController {
  constructor(
    private readonly service: GeneratedReportCardsService,
    private readonly pdf: ReportCardPdfService,
  ) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  generate(
    @Body() dto: GenerateReportCardsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.generate(req.user, dto);
  }

  @Get()
  @Roles('PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  list(
    @Query('studentId') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!studentId) throw new BadRequestException('studentId is required');
    return this.service.listForStudent(req.user, studentId);
  }

  @Get(':id')
  @Roles('PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(req.user, id);
  }

  @Get(':id/pdf')
  @Roles('PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  async download(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const card = await this.service.get(req.user, id);
    const buffer = await this.pdf.render(card.snapshot, {
      version: card.version,
      issuedAt: card.issuedAt,
      superseded: !card.current,
    });
    const name =
      `report-card-${card.snapshot.student.grNumber}-${card.term}-v${card.version}`
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .slice(0, 120);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}.pdf"`,
      'Cache-Control': 'no-store',
    });
    res.send(buffer);
  }
}
