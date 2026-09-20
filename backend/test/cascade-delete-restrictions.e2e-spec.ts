import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Historical-record delete restrictions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    // Self-healing: if a prior run's afterAll didn't complete (crash, forced-quit), don't fail on
    // stale fixtures — clear them before creating fresh ones. Attendance must be cleared before the
    // student (Attendance.student is Restrict), and the student before the school (Enrollment's
    // campus/section/academicSession relations are Restrict too).
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'cdr-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'CDR-' } },
    });
    for (const s of staleStudents) {
      await prisma.attendance
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
      await prisma.leaveRequest
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
      await prisma.feeVoucher
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
    }
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'CDR-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'CDR E2E School' },
    });
    for (const s of stale) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }
    await prisma.academicSession
      .deleteMany({ where: { label: 'CDR' } })
      .catch(() => undefined);

    const school = await prisma.school.create({
      data: { name: 'CDR E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'CDR',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'CDR Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'CDR-A' },
    });
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'cdr-teacher@schoolos.edu.pk',
        passwordHash: 'x',
        role: 'TEACHER',
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        userId: teacherUser.id,
        name: 'CDR Teacher',
        campusId: campus.id,
      },
    });
    const student = await prisma.student.create({
      data: { grNumber: 'CDR-1', name: 'CDR Student' },
    });
    studentId = student.id;
    await prisma.enrollment.create({
      data: {
        studentId,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.attendance.create({
      data: {
        studentId,
        date: new Date(),
        status: 'PRESENT',
        markedById: teacher.id,
      },
    });
    await prisma.feeVoucher.create({
      data: {
        studentId,
        academicSessionId: session.id,
        month: '2026-09',
        issueDate: new Date(),
        dueDate: new Date(),
      },
    });
    await prisma.leaveRequest.create({
      data: {
        studentId,
        startDate: new Date(),
        endDate: new Date(),
        reason: 'CDR test leave',
      },
    });
  });

  afterAll(async () => {
    await prisma.attendance
      .deleteMany({ where: { studentId } })
      .catch(() => undefined);
    await prisma.leaveRequest
      .deleteMany({ where: { studentId } })
      .catch(() => undefined);
    await prisma.feeVoucher
      .deleteMany({ where: { studentId } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { id: studentId } })
      .catch(() => undefined);
    await prisma.school
      .deleteMany({ where: { name: 'CDR E2E School' } })
      .catch(() => undefined);
    await prisma.academicSession
      .deleteMany({ where: { label: 'CDR' } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: 'cdr-teacher@schoolos.edu.pk' } })
      .catch(() => undefined);
    await app.close();
  });

  it('refuses to delete a student with attendance history instead of silently wiping it', async () => {
    await expect(
      prisma.student.delete({ where: { id: studentId } }),
    ).rejects.toThrow();

    const stillThere = await prisma.attendance.findFirst({
      where: { studentId },
    });
    expect(stillThere).not.toBeNull();
  });

  it('refuses to delete a student with fee-voucher history instead of silently wiping it', async () => {
    await expect(
      prisma.student.delete({ where: { id: studentId } }),
    ).rejects.toThrow();

    const stillThere = await prisma.feeVoucher.findFirst({
      where: { studentId },
    });
    expect(stillThere).not.toBeNull();
  });

  it('refuses to delete a student with leave-request history instead of silently wiping it', async () => {
    await expect(
      prisma.student.delete({ where: { id: studentId } }),
    ).rejects.toThrow();

    const stillThere = await prisma.leaveRequest.findFirst({
      where: { studentId },
    });
    expect(stillThere).not.toBeNull();
  });

  it('refuses to delete a fee payment that has a receipt', async () => {
    const payment = await prisma.feePayment.create({
      data: {
        amount: 1000,
        method: 'manual',
        status: 'completed',
      },
    });

    const receipt = await prisma.receipt.create({
      data: {
        feePaymentId: payment.id,
        receiptNumber: `CDR-RECEIPT-${Date.now()}`,
      },
    });

    await expect(
      prisma.feePayment.delete({ where: { id: payment.id } }),
    ).rejects.toThrow();

    const stillThere = await prisma.receipt.findUnique({
      where: { id: receipt.id },
    });

    expect(stillThere).not.toBeNull();

    await prisma.receipt.delete({ where: { id: receipt.id } });
    await prisma.feePayment.delete({ where: { id: payment.id } });
  });
});
