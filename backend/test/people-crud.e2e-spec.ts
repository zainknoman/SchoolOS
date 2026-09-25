import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('People CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'CorrectHorseBattery9!';
  const ids: Record<string, string> = {};

  async function loginAs(identifier: string, pw = password) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password: pw })
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

    // Self-healing: a crashed prior run can leave a stale pc-* Teacher blocked by a real
    // Attendance row it marked (Attendance.markedById has no onDelete — it blocks, same as
    // Attendance.student's explicit Restrict) — that block would otherwise make the broad
    // user.deleteMany below fail silently (wrapped in .catch) and leak every pc-* user, exactly
    // the class of bug this feature's own Task 1 fix (elsewhere) closed for two unrelated specs.
    const staleTeacherUsers = await prisma.user.findMany({
      where: { identifier: { startsWith: 'pc-' }, role: 'TEACHER' },
      select: { teacher: { select: { id: true } } },
    });
    for (const u of staleTeacherUsers) {
      if (u.teacher) {
        await prisma.attendance
          .deleteMany({ where: { markedById: u.teacher.id } })
          .catch(() => undefined);
      }
    }
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'pc-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'PC-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'PC E2E School' },
    });
    for (const s of stale) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const passwordHash = await argon2.hash(password);
    const school = await prisma.school.create({
      data: { name: 'PC E2E School' },
    });
    const schoolAdminUser = await prisma.user.create({
      data: {
        identifier: 'pc-school-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });
    const parentUser = await prisma.user.create({
      data: {
        identifier: 'pc-non-admin-parent@schoolos.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });

    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'PC',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'PC Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'PC-A' },
    });

    Object.assign(ids, {
      school: school.id,
      campus: campus.id,
      section: section.id,
      schoolAdmin: schoolAdminUser.id,
      parent: parentUser.id,
    });
  });

  afterAll(async () => {
    if (ids.teacher) {
      await prisma.attendance
        .deleteMany({ where: { markedById: ids.teacher } })
        .catch(() => undefined);
      await prisma.teacher
        .delete({ where: { id: ids.teacher } })
        .catch(() => undefined);
    }
    if (ids.student)
      await prisma.student
        .delete({ where: { id: ids.student } })
        .catch(() => undefined);
    if (ids.parentProfile)
      await prisma.parentProfile
        .delete({ where: { id: ids.parentProfile } })
        .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'pc-' } } })
      .catch(() => undefined);
    await app.close();
  });

  it('a PARENT (not SCHOOL_ADMIN/SUPER_ADMIN) is blocked from every write route in this plan', async () => {
    const parentToken = await loginAs('pc-non-admin-parent@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        identifier: 'blocked@schoolos.edu.pk',
        password,
        name: 'Blocked',
      })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/parents')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        identifier: 'blocked2@schoolos.edu.pk',
        password,
        name: 'Blocked',
      })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        grNumber: 'PC-BLOCKED',
        name: 'Blocked',
        sectionId: ids.section,
        relationshipType: 'FATHER', // BL-04: required
        parentProfileId: 'x',
      })
      .expect(403);
  });

  it('a SCHOOL_ADMIN can create a Teacher, and that Teacher can immediately log in with the password just set', async () => {
    const adminToken = await loginAs('pc-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        identifier: 'pc-new-teacher@schoolos.edu.pk',
        password: 'BrandNewPass1!',
        name: 'PC Teacher',
        campusId: ids.campus,
      })
      .expect(201);
    ids.teacher = res.body.id;
    expect(res.body).toEqual({
      id: ids.teacher,
      identifier: 'pc-new-teacher@schoolos.edu.pk',
      name: 'PC Teacher',
    });

    await loginAs('pc-new-teacher@schoolos.edu.pk', 'BrandNewPass1!');
  });

  it('creating a Teacher with an identifier already in use is rejected with a 400, not a 500', async () => {
    const adminToken = await loginAs('pc-school-admin@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        identifier: 'pc-new-teacher@schoolos.edu.pk',
        password: 'AnotherPass1!',
        name: 'Duplicate',
        campusId: ids.campus,
      })
      .expect(400);
  });

  it('BL-07: deleting a Teacher who has marked attendance archives them; the attendance record is kept', async () => {
    const adminToken = await loginAs('pc-school-admin@schoolos.edu.pk');

    const parentRes = await request(app.getHttpServer())
      .post('/api/v1/admin/parents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        identifier: 'pc-new-parent@schoolos.edu.pk',
        password: 'ParentPass1!',
        name: 'PC Parent',
      })
      .expect(201);
    ids.parentProfile = parentRes.body.id;

    const studentRes = await request(app.getHttpServer())
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        grNumber: 'PC-1001',
        name: 'PC Student',
        sectionId: ids.section,
        relationshipType: 'FATHER', // BL-04: required
        parentProfileId: ids.parentProfile,
      })
      .expect(201);
    ids.student = studentRes.body.id;
    expect(studentRes.body.sectionName).toBe('PC-A');
    expect(studentRes.body.parentNames).toEqual(['PC Parent']);

    await prisma.attendance.create({
      data: {
        studentId: ids.student,
        date: new Date(),
        status: 'PRESENT',
        markedById: ids.teacher,
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/teachers/${ids.teacher}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const teacher = await prisma.teacher.findUniqueOrThrow({
      where: { id: ids.teacher },
    });
    expect(teacher.archivedAt).not.toBeNull();
    expect(
      await prisma.attendance.count({ where: { markedById: ids.teacher } }),
    ).toBe(1);

    await prisma.attendance.deleteMany({ where: { markedById: ids.teacher } });
  });

  it('creating a Student with a brand-new parent works end to end, and that parent can log in', async () => {
    const adminToken = await loginAs('pc-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        grNumber: 'PC-1002',
        name: 'PC Student Two',
        sectionId: ids.section,
        relationshipType: 'FATHER', // BL-04: required
        newParent: {
          identifier: 'pc-inline-parent@schoolos.edu.pk',
          password: 'InlineParent1!',
          name: 'Inline Parent',
        },
      })
      .expect(201);

    expect(res.body.parentNames).toEqual(['Inline Parent']);
    await loginAs('pc-inline-parent@schoolos.edu.pk', 'InlineParent1!');

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/students/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
