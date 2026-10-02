import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { SetGrantsDto } from './dto/set-grants.dto';
import { Roles } from './decorators/roles.decorator';
import { AccountAccessService } from './account-access.service';
import type { RequestUser } from '../common/student-access.service';
import { ScopeCheck } from '../common/scope-check.decorator';

/** Admin account controls (BL-21). Scope rules live in AccountAccessService. */
@Controller('api/v1/admin/users')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class AccountAccessController {
  constructor(private readonly accounts: AccountAccessService) {}

  /** BL-32: the accounts staff this admin can grant modules to (own school/campus). */
  @Get('accounts-staff')
  accountsStaff(@Req() req: { user: RequestUser }) {
    return this.accounts.listAccountsStaff(req.user);
  }

  @ScopeCheck('assertCanManage')
  @Get(':id/access')
  status(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.status(id, req.user);
  }

  @ScopeCheck('assertCanManage')
  @Post(':id/disable')
  disable(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.disable(id, req.user);
  }

  @ScopeCheck('assertCanManage')
  @Post(':id/enable')
  enable(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.enable(id, req.user);
  }

  /** BL-32: replace an ACCOUNTS user's module grants (audited with before/after). */
  @ScopeCheck('assertCanManage')
  @Put(':id/grants')
  setGrants(
    @Param('id') id: string,
    @Body() dto: SetGrantsDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.accounts.setGrants(id, dto.grants, req.user);
  }

  @ScopeCheck('assertCanManage')
  @Post(':id/revoke-sessions')
  revokeSessions(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.accounts.revokeSessions(id, req.user);
  }
}
