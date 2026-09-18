# Leave Applications (FEAT-013) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A parent submits a date-range leave request for their child; SCHOOL_ADMIN/SUPER_ADMIN
approve or reject it; approving writes `LEAVE` attendance rows so it shows up on the existing
attendance calendar/summary in both clients with no new rendering path needed there.

**Architecture:** One new backend module (`leave`) following the existing `attendance`/`timetable`
module shape (controller + service + DTO, `@Roles()` guards, `StudentAccessService` ownership
checks, audit-logged writes). `LeaveRequest` and `Attendance`'s `LEAVE` status already exist in the
schema (Sprint 6.5 / FEAT-007) — no migration needed. Both clients get one new screen each: a
staff-console approval queue and a parent-app submit-and-track screen.

**Tech Stack:** NestJS + Prisma (backend, already in place), Vue 3 Composition API + Vitest
(staff-console), Flutter + flutter_test (parent-app). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-fees-leave-design.md` (Leave module + parent-app +
staff-console sections). This plan implements FEAT-013 only — FEAT-012 (Fees) is a separate plan,
`docs/superpowers/plans/2026-09-03-fees.md`, and can be executed before or after this one in either
order (their edits to shared files use non-overlapping anchors — see the seed.ts and
home_shell.dart tasks below).

## Global Constraints

- Every write gets an `AuditLog` row (`action`, `entity`, `entityId`, optional `metadata` as
  `JSON.stringify(...)`) — matches every existing module.
- Ownership checks always go through the shared `StudentAccessService.assertCanAccessStudent(user,
  studentId)` — never a bespoke check.
- Approving leave attributes the resulting `Attendance` rows to the student's current section's
  class teacher (`Section.classTeacherId`), not the approving admin — `Attendance.markedById` is a
  required FK to `Teacher`, and an admin has no `Teacher` profile of their own.
- Approved/rejected leave requests are final this sprint — no re-approval/undo.
- Route paths use the existing `@Controller('api/v1')` + per-method path convention (no global
  prefix is set in `main.ts`).

---

### Task 1: Backend — Leave module (DTO, service, controller, module)

**Files:**
- Create: `backend/src/leave/dto/create-leave-request.dto.ts`
- Create: `backend/src/leave/leave.service.ts`
- Create: `backend/src/leave/leave.service.spec.ts`
- Create: `backend/src/leave/leave.controller.ts`
- Create: `backend/src/leave/leave.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `LeaveService.create(dto: CreateLeaveRequestDto): Promise<LeaveRequestSummary>`,
  `LeaveService.listForStudent(studentId: string): Promise<LeaveRequestSummary[]>`,
  `LeaveService.listAll(status?: string): Promise<LeaveRequestSummary[]>`,
  `LeaveService.approve(id: string, actingUserId: string): Promise<LeaveRequestSummary>`,
  `LeaveService.reject(id: string, actingUserId: string): Promise<LeaveRequestSummary>`.
  `LeaveRequestSummary = { id, studentId, studentName, startDate, endDate, reason, status,
  createdAt }` (all `string` fields, dates as `YYYY-MM-DD`).
- Consumes: `StudentAccessService.assertCanAccessStudent` (`backend/src/common/student-access.service.ts`),
  `EnrollmentService.getCurrentEnrollment(studentId)` (`backend/src/enrollment/enrollment.service.ts`,
  returns `{ sectionId, ... }`, throws `NotFoundException` if none active).

- [ ] **Step 1: Write the failing unit test for `LeaveService`**

```ts
// backend/src/leave/leave.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

describe('LeaveService', () => {
  let service: LeaveService;
  let prisma: {
    leaveRequest: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    section: { findUnique: jest.Mock };
    attendance: { findMany: jest.Mock; upsert: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };

  const studentRow = { student: { name: 'Eshaal Sample' } };

  beforeEach(async () => {
    prisma = {
      leaveRequest: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      section: { findUnique: jest.fn() },
      attendance: { findMany: jest.fn(), upsert: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
      ],
    }).compile();
    service = moduleRef.get(LeaveService);
  });

  it('rejects a request whose startDate is after its endDate, without touching the database', async () => {
    await expect(
      service.create({
        studentId: 's1',
        startDate: '2026-09-10',
        endDate: '2026-09-05',
        reason: 'Family trip',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
  });

  it('creates a pending leave request', async () => {
    prisma.leaveRequest.create.mockResolvedValue({
      id: 'lr-1',
      studentId: 's1',
      startDate: new Date('2026-09-05'),
      endDate: new Date('2026-09-06'),
      reason: 'Family trip',
      status: 'pending',
      createdAt: new Date('2026-09-01'),
      ...studentRow,
    });

    const result = await service.create({
      studentId: 's1',
      startDate: '2026-09-05',
      endDate: '2026-09-06',
      reason: 'Family trip',
    });

    expect(result).toEqual({
      id: 'lr-1',
      studentId: 's1',
      studentName: 'Eshaal Sample',
      startDate: '2026-09-05',
      endDate: '2026-09-06',
      reason: 'Family trip',
      status: 'pending',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('approving writes a LEAVE attendance row per day, skipping any day already marked HOLIDAY, attributed to the class teacher', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr-1', status: 'pending' });
    prisma.leaveRequest.update.mockResolvedValue({
      id: 'lr-1',
      studentId: 's1',
      startDate: new Date('2026-09-05T00:00:00.000Z'),
      endDate: new Date('2026-09-07T00:00:00.000Z'),
      reason: 'Family trip',
      status: 'approved',
      createdAt: new Date('2026-09-01'),
      ...studentRow,
    });
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: 'teacher-1' });
    prisma.attendance.findMany.mockResolvedValue([
      { date: new Date('2026-09-06T00:00:00.000Z'), status: 'HOLIDAY' },
    ]);

    await service.approve('lr-1', 'admin-1');

    expect(prisma.attendance.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_date: { studentId: 's1', date: new Date('2026-09-05T00:00:00.000Z') } },
        create: expect.objectContaining({ status: 'LEAVE', markedById: 'teacher-1' }),
      }),
    );
    expect(prisma.attendance.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_date: { studentId: 's1', date: new Date('2026-09-06T00:00:00.000Z') } },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'leave-request.approve' }) }),
    );
  });

  it('refuses to approve when the student\'s section has no class teacher assigned', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr-1', status: 'pending' });
    prisma.leaveRequest.update.mockResolvedValue({
      id: 'lr-1',
      studentId: 's1',
      startDate: new Date('2026-09-05'),
      endDate: new Date('2026-09-05'),
      reason: 'x',
      status: 'approved',
      createdAt: new Date(),
      ...studentRow,
    });
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: null });

    await expect(service.approve('lr-1', 'admin-1')).rejects.toThrow(BadRequestException);
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
  });

  it('refuses to decide a request that is not pending', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr-1', status: 'approved' });

    await expect(service.reject('lr-1', 'admin-1')).rejects.toThrow(BadRequestException);
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when deciding a request that does not exist', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(null);

    await expect(service.approve('missing', 'admin-1')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest leave.service.spec.ts`
Expected: FAIL — `Cannot find module './leave.service'`.

- [ ] **Step 3: Implement `CreateLeaveRequestDto`**

```ts
// backend/src/leave/dto/create-leave-request.dto.ts
import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
```

- [ ] **Step 4: Implement `LeaveService`**

```ts
// backend/src/leave/leave.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

export interface LeaveRequestSummary {
  id: string;
  studentId: string;
  studentName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  createdAt: string;
}

const STUDENT_INCLUDE = { student: { select: { name: true } } } as const;

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async create(dto: CreateLeaveRequestDto): Promise<LeaveRequestSummary> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    const record = await this.prisma.leaveRequest.create({
      data: { studentId: dto.studentId, startDate, endDate, reason: dto.reason },
      include: STUDENT_INCLUDE,
    });
    return this.toSummary(record);
  }

  async listForStudent(studentId: string): Promise<LeaveRequestSummary[]> {
    const records = await this.prisma.leaveRequest.findMany({
      where: { studentId },
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async listAll(status?: string): Promise<LeaveRequestSummary[]> {
    const records = await this.prisma.leaveRequest.findMany({
      where: status ? { status } : undefined,
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  /**
   * Attendance.markedById is a required Teacher FK, so an admin approving leave (who has no
   * Teacher profile of their own) can't be the marker — the write is attributed to the student's
   * current class teacher instead. Any day in range already marked HOLIDAY is left untouched.
   */
  async approve(id: string, actingUserId: string): Promise<LeaveRequestSummary> {
    const record = await this.decide(id, 'approved');

    const enrollment = await this.enrollmentService.getCurrentEnrollment(record.studentId);
    const section = await this.prisma.section.findUnique({ where: { id: enrollment.sectionId } });
    if (!section?.classTeacherId) {
      throw new BadRequestException(
        "Cannot approve leave: this student's section has no class teacher assigned",
      );
    }

    const dates: Date[] = [];
    for (
      const cursor = new Date(record.startDate);
      cursor <= record.endDate;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      dates.push(new Date(cursor));
    }

    const existing = await this.prisma.attendance.findMany({
      where: { studentId: record.studentId, date: { in: dates } },
      select: { date: true, status: true },
    });
    const holidayDates = new Set(
      existing.filter((e) => e.status === 'HOLIDAY').map((e) => e.date.toISOString()),
    );

    for (const date of dates) {
      if (holidayDates.has(date.toISOString())) continue;
      await this.prisma.attendance.upsert({
        where: { studentId_date: { studentId: record.studentId, date } },
        create: { studentId: record.studentId, date, status: 'LEAVE', markedById: section.classTeacherId },
        update: { status: 'LEAVE', markedById: section.classTeacherId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'leave-request.approve',
        entity: 'LeaveRequest',
        entityId: id,
        metadata: JSON.stringify({ studentId: record.studentId, dateCount: dates.length }),
      },
    });

    return this.toSummary(record);
  }

  async reject(id: string, actingUserId: string): Promise<LeaveRequestSummary> {
    const record = await this.decide(id, 'rejected');
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'leave-request.reject',
        entity: 'LeaveRequest',
        entityId: id,
      },
    });
    return this.toSummary(record);
  }

  private async decide(id: string, status: 'approved' | 'rejected') {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException('This leave request has already been decided');
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status },
      include: STUDENT_INCLUDE,
    });
  }

  private toSummary(record: {
    id: string;
    studentId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    status: string;
    createdAt: Date;
    student: { name: string };
  }): LeaveRequestSummary {
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: record.student.name,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      reason: record.reason,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx jest leave.service.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Implement `LeaveController`**

```ts
// backend/src/leave/leave.controller.ts
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { StudentAccessService, RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('PARENT')
  @Post('leave-requests')
  async create(@Body() dto: CreateLeaveRequestDto, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessStudent(req.user, dto.studentId);
    return this.leaveService.create(dto);
  }

  @Get('students/:id/leave-requests')
  async getForStudent(@Param('id') studentId: string, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.leaveService.listForStudent(studentId);
  }

  // Staff-only queue — not routed through StudentAccessService, matching Timetable/Attendance's
  // staff-facing list endpoints.
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('leave-requests')
  listAll(@Query('status') status?: string) {
    return this.leaveService.listAll(status);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('leave-requests/:id/approve')
  approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaveService.approve(id, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('leave-requests/:id/reject')
  reject(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaveService.reject(id, req.user.id);
  }
}
```

- [ ] **Step 7: Implement `LeaveModule` and register it**

```ts
// backend/src/leave/leave.module.ts
import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [LeaveService, StudentAccessService, EnrollmentService],
  controllers: [LeaveController],
})
export class LeaveModule {}
```

In `backend/src/app.module.ts`, add the import and register it in the `imports` array (append after
`MessagesModule`, matching the existing one-import-per-line, one-entry-per-line style):

```ts
import { LeaveModule } from './leave/leave.module';
```
```ts
    MessagesModule,
    LeaveModule,
```

- [ ] **Step 8: Run the full backend unit suite**

Run: `cd backend && npx jest`
Expected: PASS, all suites including the new `leave.service.spec.ts`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/leave backend/src/app.module.ts
git commit -m "$(cat <<'EOF'
Add Leave module (FEAT-013): submit, list, approve, reject

Approving writes LEAVE attendance rows (skipping days already marked
HOLIDAY) so approved leave surfaces on the existing attendance
calendar/summary in both clients without a new rendering path.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SY9dorcC15KPjvNWMVpTnJ
EOF
)"
```

---

### Task 2: Backend — e2e tests for Leave

**Files:**
- Create: `backend/test/leave.e2e-spec.ts`

**Interfaces:**
- Consumes: routes from Task 1 (`POST /api/v1/leave-requests`, `GET /api/v1/students/:id/leave-requests`,
  `GET /api/v1/leave-requests`, `POST /api/v1/leave-requests/:id/approve`,
  `POST /api/v1/leave-requests/:id/reject`), plus `GET /api/v1/students/:id/attendance?month=`
  (existing, `backend/src/attendance/attendance.controller.ts`).

- [ ] **Step 1: Write the e2e spec**

```ts
// backend/test/leave.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Leave applications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'CorrectHorseBattery9!';
  const ids: Record<string, string> = {};

  async function loginAs(identifier: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'lv-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({ where: { grNumber: { startsWith: 'LV-' } } });
    for (const s of staleStudents) {
      await prisma.attendance.deleteMany({ where: { studentId: s.id } }).catch(() => undefined);
      await prisma.leaveRequest.deleteMany({ where: { studentId: s.id } }).catch(() => undefined);
    }
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'LV-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({ where: { name: 'LV E2E School' } });
    for (const s of stale) {
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }

    const school = await prisma.school.create({ data: { name: 'LV E2E School' } });
    const campus = await prisma.campus.create({ data: { schoolId: school.id, name: 'Main' } });
    const session = await prisma.academicSession.create({
      data: { label: 'LV', startDate: new Date(), endDate: new Date(), isActive: true },
    });
    const klass = await prisma.class.create({
      data: { campusId: campus.id, academicSessionId: session.id, name: 'LV Grade' },
    });

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: { identifier: 'lv-teacher@schoolos.edu.pk', passwordHash, role: 'TEACHER' },
    });
    const teacher = await prisma.teacher.create({ data: { userId: teacherUser.id, name: 'LV Teacher' } });

    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'LV-A', classTeacherId: teacher.id },
    });

    const adminUser = await prisma.user.create({
      data: { identifier: 'lv-admin@schoolos.edu.pk', passwordHash, role: 'SCHOOL_ADMIN' },
    });

    const parentAUser = await prisma.user.create({
      data: { identifier: 'lv-parent-a@schoolos.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentBUser = await prisma.user.create({
      data: { identifier: 'lv-parent-b@schoolos.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'LV Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'LV Parent B' },
    });

    const childA = await prisma.student.create({ data: { grNumber: 'LV-A1', name: 'LV Child A' } });
    const childB = await prisma.student.create({ data: { grNumber: 'LV-B1', name: 'LV Child B' } });
    await prisma.enrollment.create({
      data: {
        studentId: childA.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: childB.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.studentParent.create({ data: { studentId: childA.id, parentProfileId: parentAProfile.id } });
    await prisma.studentParent.create({ data: { studentId: childB.id, parentProfileId: parentBProfile.id } });

    // One day inside the leave range is already a HOLIDAY — approval must leave it untouched.
    await prisma.attendance.create({
      data: { studentId: childA.id, date: new Date('2026-09-02T00:00:00.000Z'), status: 'HOLIDAY', markedById: teacher.id },
    });

    Object.assign(ids, { school: school.id, childA: childA.id, childB: childB.id });
  });

  afterAll(async () => {
    await prisma.attendance
      .deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } })
      .catch(() => undefined);
    await prisma.leaveRequest
      .deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['LV-A1', 'LV-B1'] } } })
      .catch(() => undefined);
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: ['lv-teacher@schoolos.edu.pk', 'lv-admin@schoolos.edu.pk', 'lv-parent-a@schoolos.edu.pk', 'lv-parent-b@schoolos.edu.pk'],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  it('a parent can submit a leave request for their own child, but not for another parent\'s child', async () => {
    const tokenA = await loginAs('lv-parent-a@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ studentId: ids.childA, startDate: '2026-09-01', endDate: '2026-09-03', reason: 'Family trip' })
      .expect(201);

    expect(res.body).toEqual(expect.objectContaining({ status: 'pending', studentName: 'LV Child A' }));
    ids.leaveRequest = res.body.id;

    await request(app.getHttpServer())
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ studentId: ids.childB, startDate: '2026-09-01', endDate: '2026-09-03', reason: 'x' })
      .expect(403);
  });

  it('a PARENT cannot approve a leave request', async () => {
    const tokenA = await loginAs('lv-parent-a@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${ids.leaveRequest}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });

  it('a TEACHER cannot approve a leave request', async () => {
    const teacherToken = await loginAs('lv-teacher@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${ids.leaveRequest}/approve`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(403);
  });

  it('SCHOOL_ADMIN can list, approve, and it reflects on the attendance calendar (except the pre-existing HOLIDAY day)', async () => {
    const adminToken = await loginAs('lv-admin@schoolos.edu.pk');

    const pending = await request(app.getHttpServer())
      .get('/api/v1/leave-requests?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pending.body.map((r: { id: string }) => r.id)).toContain(ids.leaveRequest);

    const approved = await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${ids.leaveRequest}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(approved.body.status).toBe('approved');

    const parentToken = await loginAs('lv-parent-a@schoolos.edu.pk');
    const attendance = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance?month=2026-09`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    expect(attendance.body.days).toEqual(
      expect.arrayContaining([
        { date: '2026-09-01', status: 'LEAVE' },
        { date: '2026-09-02', status: 'HOLIDAY' },
        { date: '2026-09-03', status: 'LEAVE' },
      ]),
    );
  });

  it('cannot approve or reject a leave request that has already been decided', async () => {
    const adminToken = await loginAs('lv-admin@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${ids.leaveRequest}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `cd backend && npx jest --config ./test/jest-e2e.json leave.e2e-spec.ts`
Expected: PASS (5 tests). If the local dev server is also running against the same `dev.db`, stop
it first — SQLite lock contention will cause spurious timeouts (tracked follow-up in
`PROJECT-STATUS.md`, not something to fix in this plan).

- [ ] **Step 3: Commit**

```bash
git add backend/test/leave.e2e-spec.ts
git commit -m "$(cat <<'EOF'
Add e2e coverage for the Leave module authorization boundaries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SY9dorcC15KPjvNWMVpTnJ
EOF
)"
```

---

### Task 3: Backend — seed data

**Files:**
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `student` (Eshaal, `GR-1001`), `section3A`, `teacher`, `adminUser` — all already local
  variables in `seed.ts` by the time this point in the script runs.

- [ ] **Step 1: Insert a seeded leave request**

This insertion point is deliberately anchored on the exact, unmodified `// --- Notifications:`
comment block that already exists in the file (unchanged by this task) — so this edit applies
cleanly whether the Fees plan's seed task (`docs/superpowers/plans/2026-09-03-fees.md`, Task 8) has
already run or not.

In `backend/prisma/seed.ts`, find:

```ts
  // --- Notifications: one sample per seeded role, so a fresh dev.db never looks blank ---
  await prisma.notification.createMany({
```

Replace with:

```ts
  // --- Leave: one pending request for Eshaal, so a fresh dev.db has something in the approval
  // queue and on the parent-app's leave status list ---
  await prisma.leaveRequest.create({
    data: {
      studentId: student.id,
      startDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
      reason: 'Family wedding out of town.',
    },
  });

  // --- Notifications: one sample per seeded role, so a fresh dev.db never looks blank ---
  await prisma.notification.createMany({
```

- [ ] **Step 2: Note the new row in the seed summary log**

Find the exact line (unchanged by any other task, safe to anchor on):

```ts
  await prisma.$disconnect();
```

Replace with:

```ts
  console.log('Seeded: 1 pending leave request for Eshaal Sample.');

  await prisma.$disconnect();
```

- [ ] **Step 3: Re-seed and verify**

Run (from `backend/`): `del prisma\dev.db` (or delete the file another way), then
`npx prisma migrate deploy && npm run prisma:seed`
Expected: seed script completes and prints the new log line; no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "$(cat <<'EOF'
Seed one pending leave request

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SY9dorcC15KPjvNWMVpTnJ
EOF
)"
```

---

### Task 4: staff-console — `api.ts` additions

**Files:**
- Modify: `staff-console/src/lib/api.ts`

**Interfaces:**
- Produces: `LeaveRequestSummary` type, `api.listLeaveRequests(accessToken, status?)`,
  `api.approveLeaveRequest(accessToken, id)`, `api.rejectLeaveRequest(accessToken, id)`.

- [ ] **Step 1: Add the type and methods**

In `staff-console/src/lib/api.ts`, add near the other summary interfaces (after
`NotificationSummary`):

```ts
export interface LeaveRequestSummary {
  id: string;
  studentId: string;
  studentName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
```

Inside the `api` object, add after `markAllNotificationsRead`:

```ts
  async listLeaveRequests(accessToken: string, status?: string): Promise<LeaveRequestSummary[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/leave-requests${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async approveLeaveRequest(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/leave-requests/${id}/approve`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async rejectLeaveRequest(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/leave-requests/${id}/reject`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },
```

- [ ] **Step 2: Type-check**

Run: `cd staff-console && npm run build`
Expected: PASS (type-check + build clean).

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/lib/api.ts
git commit -m "$(cat <<'EOF'
Add Leave endpoints to the staff-console API client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SY9dorcC15KPjvNWMVpTnJ
EOF
)"
```

---

### Task 5: staff-console — Leave approval queue view

**Files:**
- Create: `staff-console/src/views/LeaveManagementView.vue`
- Create: `staff-console/src/views/LeaveManagementView.spec.ts`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`

**Interfaces:**
- Consumes: `api.listLeaveRequests`, `api.approveLeaveRequest`, `api.rejectLeaveRequest` (Task 4),
  `useAuthStore()` (`staff-console/src/stores/auth.ts`).

- [ ] **Step 1: Write the failing component spec**

```ts
// staff-console/src/views/LeaveManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LeaveManagementView from './LeaveManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listLeaveRequests: vi.fn(),
    approveLeaveRequest: vi.fn(),
    rejectLeaveRequest: vi.fn(),
  },
}));

describe('LeaveManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listLeaveRequests).mockReset();
    vi.mocked(api.approveLeaveRequest).mockReset();
    vi.mocked(api.rejectLeaveRequest).mockReset();
  });

  it('lists pending requests and approves one', async () => {
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([
      {
        id: 'lr-1',
        studentId: 's1',
        studentName: 'Eshaal Sample',
        startDate: '2026-09-05',
        endDate: '2026-09-06',
        reason: 'Family trip',
        status: 'pending',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.approveLeaveRequest).mockResolvedValue(undefined);
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([]);

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('Eshaal Sample');
    expect(wrapper.text()).toContain('Family trip');

    await wrapper.find('[data-testid="approve-lr-1"]').trigger('click');
    await flushPromises();

    expect(api.approveLeaveRequest).toHaveBeenCalledWith('token-1', 'lr-1');
  });

  it('rejects a request', async () => {
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([
      {
        id: 'lr-2',
        studentId: 's2',
        studentName: 'Ibrahim Sample',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        reason: 'Doctor appointment',
        status: 'pending',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.rejectLeaveRequest).mockResolvedValue(undefined);
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([]);

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="reject-lr-2"]').trigger('click');
    await flushPromises();

    expect(api.rejectLeaveRequest).toHaveBeenCalledWith('token-1', 'lr-2');
  });

  it('shows an error message when the list fails to load', async () => {
    vi.mocked(api.listLeaveRequests).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd staff-console && npx vitest run LeaveManagementView.spec.ts`
Expected: FAIL — cannot resolve `./LeaveManagementView.vue`.

- [ ] **Step 3: Implement `LeaveManagementView.vue`**

```vue
<!-- staff-console/src/views/LeaveManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type LeaveRequestSummary } from '../lib/api';

const auth = useAuthStore();
const statusFilter = ref<'pending' | 'approved' | 'rejected' | ''>('pending');
const requests = ref<LeaveRequestSummary[]>([]);
const errorMessage = ref<string | null>(null);
const busyId = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    requests.value = await api.listLeaveRequests(auth.accessToken, statusFilter.value || undefined);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load leave requests.';
  }
}
load();

async function onApprove(id: string) {
  if (!auth.accessToken) return;
  busyId.value = id;
  try {
    await api.approveLeaveRequest(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not approve this request.';
  } finally {
    busyId.value = null;
  }
}

async function onReject(id: string) {
  if (!auth.accessToken) return;
  busyId.value = id;
  try {
    await api.rejectLeaveRequest(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not reject this request.';
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div class="leave">
    <h1>Leave Applications</h1>

    <label class="field">
      <span>Status</span>
      <select data-testid="status-filter" v-model="statusFilter" @change="load">
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="">All</option>
      </select>
    </label>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="!requests.length && !errorMessage" class="empty">No leave requests here.</p>

    <ul class="requests-list">
      <li v-for="r in requests" :key="r.id" class="request-row">
        <div class="request-main">
          <strong>{{ r.studentName }}</strong>
          <span>{{ r.startDate }} to {{ r.endDate }}</span>
          <span class="reason">{{ r.reason }}</span>
        </div>
        <div class="request-actions">
          <span class="badge" :class="`badge-${r.status}`">{{ r.status }}</span>
          <template v-if="r.status === 'pending'">
            <button
              :data-testid="`approve-${r.id}`"
              :disabled="busyId === r.id"
              @click="onApprove(r.id)"
            >
              Approve
            </button>
            <button
              :data-testid="`reject-${r.id}`"
              class="secondary"
              :disabled="busyId === r.id"
              @click="onReject(r.id)"
            >
              Reject
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.leave {
  max-width: 720px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
  max-width: 240px;
}
select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.error {
  color: var(--color-destructive);
}
.empty {
  color: var(--color-muted);
}
.requests-list {
  list-style: none;
  padding: 0;
}
.request-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}
.request-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.reason {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.request-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.badge {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: capitalize;
}
.badge-pending {
  background: color-mix(in srgb, var(--color-accent) 15%, white);
  color: var(--color-accent);
}
.badge-approved {
  background: color-mix(in srgb, var(--color-present) 15%, white);
  color: var(--color-present);
}
.badge-rejected {
  background: color-mix(in srgb, var(--color-destructive) 15%, white);
  color: var(--color-destructive);
}
button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
button.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd staff-console && npx vitest run LeaveManagementView.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Route and nav**

In `staff-console/src/router/index.ts`, add after the `/admin/messages` route entry:

```ts
    {
      path: '/admin/leave',
      name: 'admin-leave',
      component: () => import('../views/LeaveManagementView.vue'),
      // Matches POST /api/v1/leave-requests/:id/approve's own @Roles — ACCOUNTS can't decide
      // leave, so it doesn't get this screen either (same precedent as admin-circulars/admin-timetable).
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] },
    },
```

In `staff-console/src/components/AppShell.vue`, add a `canManageLeave` computed (so the nav link
only shows for roles the route actually allows — ACCOUNTS must not see a link that then bounces
it, unlike the pre-existing Circulars gap noted in `PROJECT-STATUS.md`):

```ts
const canManageLeave = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
```

And in the admin `<template>` block, add after the `nav-fees` link:

```html
          <RouterLink v-if="canManageLeave" data-testid="nav-leave" to="/admin/leave"><Icon name="calendar-check" />Leave</RouterLink>
```

If `AppIcon.vue` has no `calendar-check` icon registered, use `calendar` instead (already used by
`nav-attendance`) — check `staff-console/src/components/AppIcon.vue`'s icon map before choosing.

- [ ] **Step 6: Build and lint**

Run: `cd staff-console && npm run build`
Expected: PASS (type-check + build clean).

- [ ] **Step 7: Commit**

```bash
git add staff-console/src/views/LeaveManagementView.vue staff-console/src/views/LeaveManagementView.spec.ts staff-console/src/router/index.ts staff-console/src/components/AppShell.vue
git commit -m "$(cat <<'EOF'
Add staff-console Leave approval queue (/admin/leave)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SY9dorcC15KPjvNWMVpTnJ
EOF
)"
```

---

### Task 6: parent-app — API client additions

**Files:**
- Modify: `parent-app/lib/src/api/models.dart`
- Modify: `parent-app/lib/src/api/api_client.dart`

**Interfaces:**
- Produces: `LeaveRequestSummary` class (with `LeaveRequestSummary.fromJson`),
  `ApiClient.leaveRequests(accessToken, studentId)`,
  `ApiClient.submitLeaveRequest(accessToken, {studentId, startDate, endDate, reason})`.

- [ ] **Step 1: Add the model**

In `parent-app/lib/src/api/models.dart`, add at the end of the file:

```dart
class LeaveRequestSummary {
  const LeaveRequestSummary({
    required this.id,
    required this.studentId,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
  });

  final String id;
  final String studentId;
  final String startDate;
  final String endDate;
  final String reason;
  final String status;

  factory LeaveRequestSummary.fromJson(Map<String, dynamic> json) => LeaveRequestSummary(
    id: json['id'] as String,
    studentId: json['studentId'] as String,
    startDate: json['startDate'] as String,
    endDate: json['endDate'] as String,
    reason: json['reason'] as String,
    status: json['status'] as String,
  );
}
```

- [ ] **Step 2: Add the client methods**

In `parent-app/lib/src/api/api_client.dart`, add after `fileDownloadUrl` (still inside the class,
before the closing brace):

```dart
  Future<List<LeaveRequestSummary>> leaveRequests(String accessToken, String studentId) async {
    final list =
        await _get('/api/v1/students/$studentId/leave-requests', accessToken) as List<dynamic>;
    return list.map((e) => LeaveRequestSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> submitLeaveRequest(
    String accessToken, {
    required String studentId,
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/leave-requests'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({
        'studentId': studentId,
        'startDate': startDate,
        'endDate': endDate,
        'reason': reason,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }
```

- [ ] **Step 3: Analyze**

Run: `cd parent-app && flutter analyze`
Expected: no new issues.

- [ ] **Step 4: Commit**

```bash
git add parent-app/lib/src/api/models.dart parent-app/lib/src/api/api_client.dart
git commit -m "$(cat <<'EOF'
Add Leave endpoints to the parent-app API client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SY9dorcC15KPjvNWMVpTnJ
EOF
)"
```

---

### Task 7: parent-app — Leave screen, wired from a new "More" tab

**Files:**
- Create: `parent-app/lib/src/screens/leave_screen.dart`
- Create: `parent-app/lib/src/screens/more_tab.dart`
- Create: `parent-app/test/screens/leave_screen_test.dart`
- Modify: `parent-app/lib/src/screens/home_shell.dart`

**Interfaces:**
- Consumes: `ApiClient.leaveRequests`, `ApiClient.submitLeaveRequest` (Task 6), `ChildSummary`
  (`parent-app/lib/src/api/models.dart`, already exists).

- [ ] **Step 1: Write the failing widget test**

```dart
// parent-app/test/screens/leave_screen_test.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/leave_screen.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1001',
  campus: 'Gulistan-e-Jauhar',
  schoolClass: 'Grade 3',
  section: '3A',
);

void main() {
  testWidgets('submits a leave request and shows it in the past-requests list', (tester) async {
    var submitted = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/leave-requests') {
          return http.Response(
            jsonEncode(
              submitted
                  ? [
                      {
                        'id': 'lr-1',
                        'studentId': 'child-1',
                        'startDate': '2026-09-05',
                        'endDate': '2026-09-06',
                        'reason': 'Family trip',
                        'status': 'pending',
                      },
                    ]
                  : [],
            ),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/leave-requests') {
          submitted = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: LeaveScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No leave requests yet.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('leaveStartDateButton')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('leaveEndDateButton')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('leaveReasonField')), 'Family trip');
    await tester.tap(find.byKey(const Key('leaveSubmitButton')));
    await tester.pumpAndSettle();

    expect(find.text('Leave request submitted.'), findsOneWidget);
    expect(find.text('Family trip'), findsWidgets);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd parent-app && flutter test test/screens/leave_screen_test.dart`
Expected: FAIL — cannot find `package:parent_app/src/screens/leave_screen.dart`.

- [ ] **Step 3: Implement `LeaveScreen`**

```dart
// parent-app/lib/src/screens/leave_screen.dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';

/// Pushed from the "More" tab (not a bottom-nav tab itself) — a submit form (child picker only
/// when there's more than one child) plus a status list of past requests for the selected child.
class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key, required this.accessToken, required this.api, required this.children});

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  late String _selectedChildId = widget.children.first.id;
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;
  String? _success;
  List<LeaveRequestSummary>? _requests;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    try {
      final requests = await widget.api.leaveRequests(widget.accessToken, _selectedChildId);
      if (mounted) setState(() => _requests = requests);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _pickDate({required bool isStart}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
      initialDate: now,
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
      } else {
        _endDate = picked;
      }
    });
  }

  String _isoDate(DateTime d) => d.toIso8601String().substring(0, 10);

  Future<void> _submit() async {
    final start = _startDate;
    final end = _endDate;
    if (start == null || end == null || _reasonController.text.trim().isEmpty) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    try {
      await widget.api.submitLeaveRequest(
        widget.accessToken,
        studentId: _selectedChildId,
        startDate: _isoDate(start),
        endDate: _isoDate(end),
        reason: _reasonController.text.trim(),
      );
      _reasonController.clear();
      setState(() {
        _startDate = null;
        _endDate = null;
        _success = 'Leave request submitted.';
      });
      await _loadRequests();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave Applications')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.children.length > 1)
            DropdownButtonFormField<String>(
              key: const Key('leaveChildDropdown'),
              initialValue: _selectedChildId,
              decoration: const InputDecoration(labelText: 'Child'),
              items: widget.children
                  .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() => _selectedChildId = value);
                _loadRequests();
              },
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  key: const Key('leaveStartDateButton'),
                  onPressed: () => _pickDate(isStart: true),
                  child: Text(_startDate == null ? 'Start date' : _isoDate(_startDate!)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  key: const Key('leaveEndDateButton'),
                  onPressed: () => _pickDate(isStart: false),
                  child: Text(_endDate == null ? 'End date' : _isoDate(_endDate!)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('leaveReasonField'),
            controller: _reasonController,
            decoration: const InputDecoration(labelText: 'Reason'),
            maxLines: 3,
          ),
          const SizedBox(height: 12),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          if (_success != null) Text(_success!, style: const TextStyle(color: Colors.green)),
          ElevatedButton(
            key: const Key('leaveSubmitButton'),
            onPressed: _isSubmitting ? null : _submit,
            child: Text(_isSubmitting ? 'Submitting…' : 'Submit request'),
          ),
          const SizedBox(height: 24),
          Text('Past requests', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_requests == null)
            const Center(child: CircularProgressIndicator())
          else if (_requests!.isEmpty)
            const Text('No leave requests yet.')
          else
            for (final r in _requests!)
              Card(
                child: ListTile(
                  title: Text('${r.startDate} to ${r.endDate}'),
                  subtitle: Text(r.reason),
                  trailing: Text(r.status),
                ),
              ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd parent-app && flutter test test/screens/leave_screen_test.dart`
Expected: PASS.

- [ ] **Step 5: Implement `MoreTab`**

```dart
// parent-app/lib/src/screens/more_tab.dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'leave_screen.dart';

/// "More" bottom-nav tab (index 5) — a menu of screens that don't warrant their own tab. Leave
/// Applications is the first entry; later additions (settings, profile, …) are out of scope here.
class MoreTab extends StatelessWidget {
  const MoreTab({super.key, required this.accessToken, required this.api, required this.children});

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            key: const Key('moreLeaveApplications'),
            leading: const Icon(Icons.event_busy_outlined),
            title: const Text('Leave Applications'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => LeaveScreen(accessToken: accessToken, api: api, children: children),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 6: Wire it into `HomeShell`**

In `parent-app/lib/src/screens/home_shell.dart`, add the import:

```dart
import 'more_tab.dart';
```

Insert a new branch right before the generic fallback (find the exact existing text below and
insert this branch immediately above it — this anchor is untouched by the Fees plan's Task 12,
which inserts its own `_tabIndex == 4` branch at the same anchor, so both apply cleanly regardless
of execution order):

Find:
```dart
    final labels = ['Home', 'Calendar', 'Notifications', 'Messages', 'Fees', 'More'];
```

Replace with:
```dart
    if (_tabIndex == 5) {
      return MoreTab(
        accessToken: context.read<AuthState>().accessToken!,
        api: context.read<ApiClient>(),
        children: _children,
      );
    }

    final labels = ['Home', 'Calendar', 'Notifications', 'Messages', 'Fees', 'More'];
```

- [ ] **Step 7: Run the full parent-app test suite and analyze**

Run: `cd parent-app && flutter test && flutter analyze`
Expected: PASS, no new analyzer issues.

- [ ] **Step 8: Commit**

```bash
git add parent-app/lib/src/screens/leave_screen.dart parent-app/lib/src/screens/more_tab.dart parent-app/test/screens/leave_screen_test.dart parent-app/lib/src/screens/home_shell.dart
git commit -m "$(cat <<'EOF'
Add parent-app Leave Applications screen under the More tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SY9dorcC15KPjvNWMVpTnJ
EOF
)"
```

---

## Self-Review Notes (for the plan author, not a task)

- Spec coverage: create/list/approve/reject (backend), staff-console approval queue, parent-app
  submit-and-track screen, attendance-calendar reflection (via `LEAVE` rows, no new client
  rendering) — all covered above.
- No placeholders: every step has real, complete code.
- Type consistency checked: `LeaveRequestSummary` shape (`id, studentId, studentName, startDate,
  endDate, reason, status, createdAt`) matches across the backend service, e2e assertions, and the
  staff-console `api.ts` type (the parent-app's `LeaveRequestSummary` intentionally omits
  `studentName`/`createdAt` — a parent already knows whose request it is and doesn't need the
  submission timestamp).
