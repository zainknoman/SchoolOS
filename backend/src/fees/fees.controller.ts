import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  Patch,
  Query,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FeeStructuresService } from './fee-structures.service';
import { FeeVouchersService } from './fee-vouchers.service';
import { FeePaymentsService } from './fee-payments.service';
import { FeesPdfService } from './fees-pdf.service';
import {
  CreateFeeStructureDto,
  UpdateFeeStructureDto,
} from './dto/create-fee-structure.dto';
import { IssueVouchersDto } from './dto/issue-vouchers.dto';
import { PayVoucherDto } from './dto/pay-voucher.dto';
import { ReconcilePaymentDto } from './dto/reconcile-payment.dto';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
export class FeesController {
  constructor(
    private readonly feeStructures: FeeStructuresService,
    private readonly feeVouchers: FeeVouchersService,
    private readonly feePayments: FeePaymentsService,
    private readonly feesPdf: FeesPdfService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @Post('fee-structures')
  createStructure(
    @Body() dto: CreateFeeStructureDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feeStructures.create(dto, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @Get('fee-structures')
  listStructures(
    @Req() req: AuthenticatedRequest,
    @Query('schoolId') schoolId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.feeStructures.list(req.user, {
      schoolId,
      includeArchived: includeArchived === 'true',
    });
  }

  // BL-03: edit while editable, or move through DRAFT -> ACTIVE -> (LOCKED) -> ARCHIVED.
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @Patch('fee-structures/:id')
  updateStructure(
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feeStructures.update(id, dto, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @Post('fee-vouchers')
  issueVouchers(
    @Body() dto: IssueVouchersDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feeVouchers.issue(dto, req.user.id);
  }

  @Get('students/:id/fees')
  async getForStudent(
    @Param('id') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.feeVouchers.getForStudent(studentId);
  }

  @Get('students/:id/fees/payments')
  async getPaymentsForStudent(
    @Param('id') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.feePayments.getForStudent(studentId);
  }

  @Get('fee-vouchers/:id/pdf')
  async voucherPdf(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const voucher = await this.feeVouchers.getById(id);
    await this.studentAccess.assertCanAccessStudent(
      req.user,
      voucher.studentId,
    );
    const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
    const buffer = await this.feesPdf.renderVoucherPdf({
      studentName: voucher.student.name,
      grNumber: voucher.student.grNumber,
      month: voucher.month,
      dueDate: voucher.dueDate.toISOString().slice(0, 10),
      items: voucher.items.map((i) => ({ label: i.label, amount: i.amount })),
      totalAmount,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="voucher-${voucher.id}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(buffer);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @Post('fee-vouchers/:id/reconcile')
  reconcile(
    @Param('id') id: string,
    @Body() dto: ReconcilePaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.feePayments.reconcile(id, dto, req.user.id);
  }

  @Roles('PARENT')
  @Post('fee-vouchers/:id/pay')
  async pay(
    @Param('id') id: string,
    @Body() dto: PayVoucherDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const voucher = await this.feeVouchers.getById(id);
    await this.studentAccess.assertCanAccessStudent(
      req.user,
      voucher.studentId,
    );
    return this.feePayments.pay(id, req.user.id, dto.method);
  }

  @Get('fee-payments/:id')
  async getPayment(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const payment = await this.feePayments.getById(id);
    const studentId = payment.allocations[0]?.feeVoucher.studentId;
    if (!studentId) {
      throw new NotFoundException('Payment not found');
    }
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.feePayments.toSummary(payment);
  }

  @Get('fee-payments/:id/receipt.pdf')
  async receiptPdf(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const payment = await this.feePayments.getById(id);
    const studentId = payment.allocations[0]?.feeVoucher.studentId;
    if (!studentId) {
      throw new NotFoundException('Payment not found');
    }
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    if (!payment.receipt) {
      throw new NotFoundException('Receipt not available yet');
    }
    const buffer = await this.feesPdf.renderReceiptPdf({
      receiptNumber: payment.receipt.receiptNumber,
      studentName: payment.allocations[0].feeVoucher.student.name,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.createdAt.toISOString().slice(0, 10),
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${payment.id}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(buffer);
  }
}
