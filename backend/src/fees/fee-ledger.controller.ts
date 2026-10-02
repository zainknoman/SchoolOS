import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FeeLedgerService } from './fee-ledger.service';
import { FeePaymentsService } from './fee-payments.service';
import { FeeVouchersService } from './fee-vouchers.service';
import {
  AdjustVoucherDto,
  CarryForwardDto,
  CreateConcessionDto,
  ReasonDto,
  SchoolRunDto,
  UpdateFeePolicyDto,
} from './dto/fee-ledger.dto';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
import { OrgScopeService } from '../common/org-scope.service';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  PAYMENT_GATEWAY_ADAPTER_FACTORY,
  PaymentGatewayAdapterFactoryImpl,
} from './payment-gateway-adapter-factory';
import { ScopeCheck } from '../common/scope-check.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

/**
 * BL-08: the pilot fee ledger — concessions, adjustments and reversals, payment reversals, late
 * fees, carry-forward and the outstanding/defaulters report. Staff routes are confined to the
 * caller's school (and campus) through StudentAccessService / OrgScopeService.
 */
@Controller('api/v1')
export class FeeLedgerController {
  constructor(
    private readonly ledger: FeeLedgerService,
    private readonly payments: FeePaymentsService,
    private readonly vouchers: FeeVouchersService,
    private readonly studentAccess: StudentAccessService,
    private readonly orgScope: OrgScopeService,
    @Inject(PAYMENT_GATEWAY_ADAPTER_FACTORY)
    private readonly gateways: PaymentGatewayAdapterFactoryImpl,
  ) {}

  /** Which online methods this deployment has enabled (none in the pilot, RD-14). */
  @Get('fees/payment-options')
  paymentOptions() {
    return { methods: this.gateways.enabledMethods() };
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('assertCanAccessStudent')
  @Get('students/:id/fee-concessions')
  async listConcessions(
    @Param('id') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.ledger.listConcessions(studentId);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('assertCanAccessStudent')
  @Post('students/:id/fee-concessions')
  async createConcession(
    @Param('id') studentId: string,
    @Body() dto: CreateConcessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.ledger.createConcession(studentId, dto, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('assertCanAccessStudent')
  @Post('fee-concessions/:id/end')
  async endConcession(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const c = await this.ledger.getConcession(id);
    await this.studentAccess.assertCanAccessStudent(req.user, c.studentId);
    return this.ledger.endConcession(id, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('assertCanAccessStudent')
  @Post('fee-vouchers/:id/adjustments')
  async adjust(
    @Param('id') id: string,
    @Body() dto: AdjustVoucherDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const voucher = await this.vouchers.getById(id);
    await this.studentAccess.assertCanAccessStudent(
      req.user,
      voucher.studentId,
    );
    return this.ledger.adjust(id, dto, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('assertCanAccessStudent')
  @Post('fee-items/:id/reverse')
  async reverseItem(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const item = await this.ledger.getItem(id);
    await this.studentAccess.assertCanAccessStudent(
      req.user,
      item.feeVoucher.studentId,
    );
    return this.ledger.reverseItem(id, dto.reason, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('assertCanAccessStudent')
  @Post('fee-payments/:id/reverse')
  async reversePayment(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const payment = await this.payments.getById(id);
    for (const a of payment.allocations) {
      await this.studentAccess.assertCanAccessStudent(
        req.user,
        a.feeVoucher.studentId,
      );
    }
    return this.payments.reverse(id, dto.reason, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('orgScope.resolve')
  @Get('fee-policy')
  getPolicy(
    @Query('schoolId') schoolId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ledger.getPolicy(req.user, schoolId || undefined);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('orgScope.resolve')
  @Put('fee-policy')
  updatePolicy(
    @Body() dto: UpdateFeePolicyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ledger.updatePolicy(req.user, dto);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('orgScope.resolve')
  @Post('fee-vouchers/apply-late-fees')
  applyLateFees(@Body() dto: SchoolRunDto, @Req() req: AuthenticatedRequest) {
    return this.ledger.applyLateFees(req.user, dto?.schoolId);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('orgScope.resolve')
  @Post('fee-vouchers/carry-forward')
  carryForward(@Body() dto: CarryForwardDto, @Req() req: AuthenticatedRequest) {
    return this.ledger.carryForward(req.user, dto);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @ScopeCheck('assertCanAccessSection')
  @Get('fee-reports/outstanding')
  async outstanding(
    @Req() req: AuthenticatedRequest,
    @Query('schoolId') schoolId?: string,
    @Query('campusId') campusId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('defaultersOnly') defaultersOnly?: string,
  ) {
    if (campusId) await this.orgScope.assertCampusAccess(req.user, campusId);
    if (classId)
      await this.studentAccess.assertCanAccessClass(req.user, classId);
    if (sectionId) {
      await this.studentAccess.assertCanAccessSection(req.user, sectionId);
    }
    return this.ledger.outstanding(req.user, {
      schoolId: schoolId || undefined,
      campusId: campusId || undefined,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      defaultersOnly: defaultersOnly === 'true',
    });
  }
}
