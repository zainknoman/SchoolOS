import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Sections cross-campus access (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    // Self-healing: if a prior run's afterAll didn't complete (crash, forced-quit, or the
    // Teacher.campus Restrict FK silently blocking the school delete — see afterAll below),
    // don't fail on stale fixtures — clear them before creating fresh ones. Users must be
    // deleted before the school (Teacher.userId is Cascade, so this also removes stale
    // Teacher rows that would otherwise Restrict-block the Campus cascade).
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'sa-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({ where: { name: 'SA E2E School' } });
    for (const s of stale) {
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }

    const school = await prisma.school.create({ data: { name: 'SA E2E School' } });
    const campusA = await prisma.campus.create({ data: { schoolId: school.id, name: 'SA Campus A' } });
    const campusB = await prisma.campus.create({ data: { schoolId: school.id, name: 'SA Campus B' } });
    const session = await prisma.academicSession.create({
      data: { label: 'SA', startDate: new Date(), endDate: new Date(), isActive: true },
    });
    const classA = await prisma.class.create({
      data: { campusId: campusA.id, academicSessionId: session.id, name: 'SA Grade' },
    });
    const sectionA = await prisma.section.create({ data: { classId: classA.id, name: 'SA-A' } });
    ids.school = school.id;
    ids.sectionA = sectionA.id;

    const passwordHash = await argon2.hash('ChangeMe123!');
    const teacherBUser = await prisma.user.create({
      data: { identifier: 'sa-teacher-b@seeds.edu.pk', passwordHash, role: 'TEACHER' },
    });
    await prisma.teacher.create({ data: { userId: teacherBUser.id, name: 'SA Teacher B', campusId: campusB.id } });
  });

  afterAll(async () => {
    // Teacher.campus is Restrict (see Sprint L brief), so the teacher created above blocks the
    // school delete until it (and the user it belongs to, via Cascade) is removed first —
    // otherwise this delete silently no-ops (wrapped in .catch) and the next run's beforeAll
    // self-heal has to do it.
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'sa-' } } })
      .catch(() => undefined);
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await app.close();
  });

  it("denies a teacher reading another campus section's roster", async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'sa-teacher-b@seeds.edu.pk', password: 'ChangeMe123!' })
      .expect(201);
    const teacherBToken = loginRes.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/sections/${ids.sectionA}/students`)
      .set('Authorization', `Bearer ${teacherBToken}`);
    expect(res.status).toBe(403);
  });
});
