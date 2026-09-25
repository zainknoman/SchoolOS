import { PageQueryDto, toPageRequest } from '../common/pagination';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { ParentService } from './parent.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { UpdateParentChildLinkDto } from './dto/update-parent-child-link.dto';
import { LinkParentChildDto } from './dto/link-parent-child.dto';
import { LookupParentDto } from './dto/lookup-parent.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { AccountAccessService } from '../auth/account-access.service';
import {
  AUTH_LOGIN_THROTTLE_LIMIT,
  THROTTLE_TTL_MS,
} from '../config/throttler.config';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/parents')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class ParentController {
  constructor(
    private readonly parentService: ParentService,
    private readonly accounts: AccountAccessService,
  ) {}

  @Post()
  create(@Body() dto: CreateParentDto, @Req() req: AuthenticatedRequest) {
    return this.parentService.create(dto, req.user.id);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query() page: PageQueryDto) {
    return this.parentService.list(req.user, toPageRequest(page));
  }

  /** BL-23: guardian profiles sharing a CNIC/identifier/phone/e-mail — report only, never merged. */
  @Roles('SUPER_ADMIN')
  @Get('duplicates')
  duplicates(@Req() req: AuthenticatedRequest) {
    return this.parentService.duplicates(req.user);
  }

  /** BL-23: find an existing guardian by exact identifier or CNIC (to link, not duplicate). */
  @Post('lookup')
  lookup(@Body() dto: LookupParentDto, @Req() req: AuthenticatedRequest) {
    return this.parentService.lookup(dto, req.user);
  }

  // BL-64: one-time temporary password for a parent (pilot fallback without e-mail). Throttled like
  // login; the password appears only in this response — never in logs or the audit trail.
  @Throttle({
    default: { limit: AUTH_LOGIN_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS },
  })
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.accounts.resetParentPassword(id, req.user);
  }

  @Get(':id')
  profile(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.parentService.getProfile(id, req.user);
  }

  @Post(':id/children')
  linkChild(
    @Param('id') id: string,
    @Body() dto: LinkParentChildDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.parentService.linkChild(id, dto, req.user);
  }

  @Delete(':id/children/:studentId')
  async unlinkChild(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.parentService.unlinkChild(id, studentId, req.user);
  }

  @Patch(':id/children/:studentId')
  updateChildLink(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateParentChildLinkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.parentService.updateChildLink(id, studentId, dto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateParentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.parentService.update(id, dto, req.user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.parentService.delete(id, req.user);
  }
}
