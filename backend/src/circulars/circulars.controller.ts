import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CircularsService } from './circulars.service';
import { CreateCircularDto } from './dto/create-circular.dto';
import { RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiDraftingService } from '../ai-drafting/ai-drafting.service';
import { SuggestDraftDto } from '../ai-drafting/dto/suggest-draft.dto';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/circulars')
export class CircularsController {
  constructor(
    private readonly circularsService: CircularsService,
    private readonly aiDraftingService: AiDraftingService,
  ) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  publish(@Body() dto: CreateCircularDto, @Req() req: AuthenticatedRequest) {
    return this.circularsService.publish(dto, req.user);
  }

  // Never auto-publishes — the suggestion is returned for the client to place into the compose
  // textarea for staff to edit before calling publish() above.
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('draft-suggestion')
  suggestDraft(@Body() dto: SuggestDraftDto, @Req() req: AuthenticatedRequest) {
    return this.aiDraftingService.suggestDraft(
      req.user.id,
      'circular',
      dto.context,
    );
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.circularsService.listForUser(req.user);
  }

  @Roles('PARENT')
  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.circularsService.markRead(id, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get(':id/stats')
  getStats(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.circularsService.getStats(id, req.user);
  }
}
