import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Roles('PARENT')
  @Post()
  create(@Body() dto: CreateConversationDto, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.create(dto, req.user);
  }

  @Get()
  list(@Query('q') q: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.listForUser(req.user, q);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.getById(id, req.user);
  }

  @Post(':id/messages')
  reply(@Param('id') id: string, @Body() dto: SendMessageDto, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.reply(id, req.user.id, dto);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.markRead(id, req.user);
  }
}
