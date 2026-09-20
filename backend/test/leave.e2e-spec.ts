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
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'LV-' } },
    });
    for (const s of staleStudents) {
      await prisma.attendance
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
      await prisma.leaveRequest
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
    }
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'LV-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'LV E2E School' },
    });
    for (const s of stale) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'LV E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'LV',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'LV Grade',
      },
    });

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'lv-teacher@schoolos.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'LV Teacher', campusId: campus.id },
    });

    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'LV-A', classTeacherId: teacher.id },
    });
    // No classTeacherId — used to prove a failed approve() precondition never leaves the
    // LeaveRequest stuck at 'approved' (it must stay 'pending' and remain retryable).
    const sectionNoTeacher = await prisma.section.create({
      data: { classId: klass.id, name: 'LV-NoTeacher' },
    });

    await prisma.user.create({
      data: {
        identifier: 'lv-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });

    const parentAUser = await prisma.user.create({
      data: {
        identifier: 'lv-parent-a@schoolos.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentBUser = await prisma.user.create({
      data: {
        identifier: 'lv-parent-b@schoolos.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'LV Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'LV Parent B' },
    });

    const childA = await prisma.student.create({
      data: { grNumber: 'LV-A1', name: 'LV Child A' },
    });
    const childB = await prisma.student.create({
      data: { grNumber: 'LV-B1', name: 'LV Child B' },
    });
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
    await prisma.studentParent.create({
      data: { studentId: childA.id, parentProfileId: parentAProfile.id },
    });
    await prisma.studentParent.create({
      data: { studentId: childB.id, parentProfileId: parentBProfile.id },
    });

    // One day inside the leave range is already a HOLIDAY — approval must leave it untouched.
    await prisma.attendance.create({
      data: {
        studentId: childA.id,
        date: new Date('2026-09-02T00:00:00.000Z'),
        status: 'HOLIDAY',
        markedById: teacher.id,
      },
    });

    // Child enrolled in a section with no class teacher, plus a pending leave request for them —
    // used to prove a failed approve() precondition rolls back cleanly (see the persisted-state
    // regression test below).
    const childC = await prisma.student.create({
      data: { grNumber: 'LV-C1', name: 'LV Child C' },
    });
    await prisma.enrollment.create({
      data: {
        studentId: childC.id,
        campusId: campus.id,
        sectionId: sectionNoTeacher.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    const noTeacherLeaveRequest = await prisma.leaveRequest.create({
      data: {
        studentId: childC.id,
        startDate: new Date('2026-09-10T00:00:00.000Z'),
        endDate: new Date('2026-09-11T00:00:00.000Z'),
        reason: 'Testing missing class teacher',
      },
    });

    Object.assign(ids, {
      school: school.id,
      childA: childA.id,
      childB: childB.id,
      childC: childC.id,
      noTeacherLeaveRequest: noTeacherLeaveRequest.id,
    });
  });

  afterAll(async () => {
    await prisma.attendance
      .deleteMany({
        where: { studentId: { in: [ids.childA, ids.childB, ids.childC] } },
      })
      .catch(() => undefined);
    await prisma.leaveRequest
      .deleteMany({
        where: { studentId: { in: [ids.childA, ids.childB, ids.childC] } },
      })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['LV-A1', 'LV-B1', 'LV-C1'] } } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'lv-teacher@schoolos.edu.pk',
              'lv-admin@schoolos.edu.pk',
              'lv-parent-a@schoolos.edu.pk',
              'lv-parent-b@schoolos.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  it("a parent can submit a leave request for their own child, but not for another parent's child", async () => {
    const tokenA = await loginAs('lv-parent-a@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        studentId: ids.childA,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        reason: 'Family trip',
      })
      .expect(201);

    expect(res.body).toEqual(
      expect.objectContaining({ status: 'pending', studentName: 'LV Child A' }),
    );
    ids.leaveRequest = res.body.id;

    await request(app.getHttpServer())
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        studentId: ids.childB,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        reason: 'x',
      })
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
    expect(pending.body.map((r: { id: string }) => r.id)).toContain(
      ids.leaveRequest,
    );

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

  it('a failed approve (no class teacher on the section) leaves the LeaveRequest persisted as pending, not stuck approved', async () => {
    const adminToken = await loginAs('lv-admin@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${ids.noTeacherLeaveRequest}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    // The real, persisted row — not a mock's call log — must still say 'pending'.
    const persisted = await prisma.leaveRequest.findUnique({
      where: { id: ids.noTeacherLeaveRequest },
    });
    expect(persisted?.status).toBe('pending');

    // And, being still pending, it must remain retryable (e.g. rejectable) rather than stuck.
    await request(app.getHttpServer())
      .post(`/api/v1/leave-requests/${ids.noTeacherLeaveRequest}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });
});
