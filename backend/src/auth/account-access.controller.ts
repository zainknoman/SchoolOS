import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Roles } from './decorators/roles.decorator';
import { AccountAccessService } from './account-access.service';
import type { RequestUser } from '../common/student-access.service';

/** Admin account controls (BL-21). Scope rules live in AccountAccessService. */
@Controller('api/v1/admin/users')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class AccountAccessController {
  constructor(private readonly accounts: AccountAccessService) {}

  @Get(':id/access')
  status(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.status(id, req.user);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.disable(id, req.user);
  }

  @Post(':id/enable')
  enable(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.enable(id, req.user);
  }

  @Post(':id/revoke-sessions')
  revokeSessions(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.revokeSessions(id, req.user);
  }
}
