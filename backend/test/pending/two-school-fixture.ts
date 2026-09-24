import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * BL-18 failing-first scaffold. Each pending spec asserts the TARGET behaviour of a backlog item
 * and is registered with `pending(...)`: under a normal run it is `it.failing`, so CI stays green
 * while the defect exists and turns RED the moment the behaviour is fixed — the implementer must
 * then move the test into the regular suite (replace `pending` with `it`). Run with
 * `E2E_PENDING_STRICT=1` to execute them as plain tests and see each documented failure reason.
 */
export const pending: jest.It =
  process.env.E2E_PENDING_STRICT === '1' ? it : it.failing;

export const PASSWORD = 'CorrectHorseBattery9!';

export interface TwoSchools {
  app: INestApplication<App>;
  prisma: PrismaService;
  ids: {
    schoolA: string;
    schoolB: string;
    campusA: string;
    campusB: string;
    sessionA: string;
    sessionB: string;
    sectionA: string;
    sectionANoTeacher: string;
    sectionB: string;
    studentA: string;
    studentANoTeacher: string;
    studentB: string;
    parentA: string;
    parentB: string;
    parentShared: string;
    parentAUser: string;
  };
  login(identifier: string): Promise<string>;
  close(): Promise<void>;
}

/**
 * Two REAL schools, each with a campus, its own active session, class and section; school A also
 * has a section WITHOUT a class teacher. Users (identifiers `<prefix>-…`): super admin, one
 * SCHOOL_ADMIN per school, one parent per school and one parent with a child in BOTH schools.
 */
export async function createTwoSchools(prefix: string): Promise<TwoSchools> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  const prisma = moduleFixture.get(PrismaService);
  // Same global pipe as main.ts, so DTO validation/transformation behaves as in production.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const P = prefix.toUpperCase();
  await cleanup(prisma, prefix);

  const passwordHash = await argon2.hash(PASSWORD);
  const user = (identifier: string, role: string, extra: object = {}) =>
    prisma.user.create({
      data: {
        identifier: `${prefix}-${identifier}`,
        passwordHash,
        role: role as never,
        ...extra,
      },
    });

  const org = async (tag: 'A' | 'B') => {
    const school = await prisma.school.create({
      data: { name: `${P} School ${tag}` },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: `${P} Campus ${tag}` },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: `${P} ${tag}`,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: `${P} Grade ${tag}`,
      },
    });
    const teacherUser = await user(`teacher-${tag.toLowerCase()}`, 'TEACHER', {
      schoolId: school.id,
      campusId: campus.id,
    });
    const teacher = await prisma.teacher.create({
      data: {
        userId: teacherUser.id,
        name: `${P} Teacher ${tag}`,
        campusId: campus.id,
      },
    });
    const section = await prisma.section.create({
      data: {
        classId: klass.id,
        name: `${P}-${tag}`,
        classTeacherId: teacher.id,
      },
    });
    await user(`admin-${tag.toLowerCase()}`, 'SCHOOL_ADMIN', {
      schoolId: school.id,
    });
    return { school, campus, session, klass, section };
  };
  const a = await org('A');
  const b = await org('B');
  const sectionANoTeacher = await prisma.section.create({
    data: { classId: a.klass.id, name: `${P}-A-NOCT` },
  });
  await user('super', 'SUPER_ADMIN');

  const student = async (
    gr: string,
    o: { campus: { id: string }; session: { id: string; startDate: Date } },
    sectionId: string,
  ) => {
    const s = await prisma.student.create({
      data: { grNumber: `${P}-${gr}`, name: `${P} Student ${gr}` },
    });
    await prisma.enrollment.create({
      data: {
        studentId: s.id,
        campusId: o.campus.id,
        sectionId,
        academicSessionId: o.session.id,
        startDate: o.session.startDate,
        status: 'ACTIVE',
      },
    });
    return s;
  };
  const studentA = await student('A1', a, a.section.id);
  const studentANoTeacher = await student('A2', a, sectionANoTeacher.id);
  const studentB = await student('B1', b, b.section.id);

  const parent = async (tag: string, children: string[]) => {
    const u = await user(`parent-${tag}`, 'PARENT');
    const profile = await prisma.parentProfile.create({
      data: { userId: u.id, name: `${P} Parent ${tag}` },
    });
    for (const studentId of children) {
      await prisma.studentParent.create({
        data: { studentId, parentProfileId: profile.id },
      });
    }
    return { user: u, profile };
  };
  const parentA = await parent('a', [studentA.id, studentANoTeacher.id]);
  const parentB = await parent('b', [studentB.id]);
  const parentShared = await parent('shared', [studentA.id, studentB.id]);

  return {
    app,
    prisma,
    ids: {
      schoolA: a.school.id,
      schoolB: b.school.id,
      campusA: a.campus.id,
      campusB: b.campus.id,
      sessionA: a.session.id,
      sessionB: b.session.id,
      sectionA: a.section.id,
      sectionANoTeacher: sectionANoTeacher.id,
      sectionB: b.section.id,
      studentA: studentA.id,
      studentANoTeacher: studentANoTeacher.id,
      studentB: studentB.id,
      parentA: parentA.profile.id,
      parentB: parentB.profile.id,
      parentShared: parentShared.profile.id,
      parentAUser: parentA.user.id,
    },
    async login(identifier: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: `${prefix}-${identifier}`, password: PASSWORD })
        .expect(201);
      return res.body.accessToken as string;
    },
    async close() {
      await cleanup(prisma, prefix);
      await app.close();
    },
  };
}

/** Removes everything a previous run created, in foreign-key order (Restrict relations first). */
async function cleanup(prisma: PrismaService, prefix: string) {
  const P = prefix.toUpperCase();
  const students = { grNumber: { startsWith: `${P}-` } };
  const users = { identifier: { startsWith: `${prefix}-` } };
  await prisma.attendance.deleteMany({ where: { student: students } });
  await prisma.leaveRequest.deleteMany({ where: { student: students } });
  await prisma.circularRecipient.deleteMany({
    where: { circular: { author: users } },
  });
  await prisma.circular.deleteMany({ where: { author: users } });
  await prisma.holiday.deleteMany({ where: { title: { startsWith: P } } });
  await prisma.user.deleteMany({ where: users });
  await prisma.student.deleteMany({ where: students });
  await prisma.school.deleteMany({ where: { name: { startsWith: `${P} ` } } });
  await prisma.academicSession.deleteMany({
    where: { label: { startsWith: `${P} ` } },
  });
}
