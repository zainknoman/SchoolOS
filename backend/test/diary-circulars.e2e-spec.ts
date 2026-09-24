import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_ADAPTER } from '../src/storage/storage-adapter';
import type { StorageAdapter } from '../src/storage/storage-adapter';
import { MAX_UPLOAD_BYTES } from '../src/files/files.controller';

describe('Diary + Circulars (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: StorageAdapter;
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
    storage = moduleFixture.get(STORAGE_ADAPTER);
    await app.init();

    const staleAdmin = await prisma.user.findUnique({
      where: { identifier: 'dc-admin@schoolos.edu.pk' },
    });
    if (staleAdmin) {
      await prisma.circular
        .deleteMany({ where: { authorId: staleAdmin.id } })
        .catch(() => undefined);
    }
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'dc-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'DC-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'DC E2E School' },
    });
    for (const s of stale) {
      // DiaryEntry.section is Restrict (Sprint: Org Structure CRUD), so a stale DiaryEntry row
      // from a prior run silently blocks this school delete too.
      const staleSections = await prisma.section.findMany({
        where: { class: { campus: { schoolId: s.id } } },
        select: { id: true },
      });
      await prisma.diaryEntry
        .deleteMany({
          where: { sectionId: { in: staleSections.map((sec) => sec.id) } },
        })
        .catch(() => undefined);
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'DC E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'DC',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'DC Grade',
      },
    });
    const sectionA = await prisma.section.create({
      data: { classId: klass.id, name: 'DC-A' },
    });
    const sectionB = await prisma.section.create({
      data: { classId: klass.id, name: 'DC-B' },
    });
    // BL-02: subjects belong to a school (unique per school).
    const subject = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'DC Urdu' } },
      update: {},
      create: { name: 'DC Urdu', schoolId: school.id },
    });
    ids.school = school.id;
    ids.sectionA = sectionA.id;
    ids.sectionB = sectionB.id;
    ids.subject = subject.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'dc-teacher@schoolos.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'DC Teacher', campusId: campus.id },
    });
    // dc-teacher must actually be assigned to section DC-A (as its homeroom/class teacher) for
    // the new subject/class assignment check (StudentAccessService) to allow them past
    // campus-only scoping.
    await prisma.section.update({
      where: { id: sectionA.id },
      data: { classTeacherId: teacher.id },
    });
    const campusB = await prisma.campus.create({
      data: { schoolId: school.id, name: 'DC Campus B' },
    });
    const teacherBUser = await prisma.user.create({
      data: {
        identifier: 'dc-teacher-b@schoolos.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    const teacherB = await prisma.teacher.create({
      data: {
        userId: teacherBUser.id,
        name: 'DC Teacher B',
        campusId: campusB.id,
      },
    });
    ids.campusB = campusB.id;
    ids.teacherB = teacherB.id;
    const adminUser = await prisma.user.create({
      data: {
        identifier: 'dc-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });
    ids.adminUserId = adminUser.id;

    const parentAUser = await prisma.user.create({
      data: {
        identifier: 'dc-parent-a@schoolos.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentBUser = await prisma.user.create({
      data: {
        identifier: 'dc-parent-b@schoolos.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'DC Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'DC Parent B' },
    });

    const childA = await prisma.student.create({
      data: { grNumber: 'DC-A1', name: 'DC Child A' },
    });
    const childB = await prisma.student.create({
      data: { grNumber: 'DC-B1', name: 'DC Child B' },
    });
    await prisma.enrollment.create({
      data: {
        studentId: childA.id,
        campusId: campus.id,
        sectionId: sectionA.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: childB.id,
        campusId: campus.id,
        sectionId: sectionB.id,
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

    Object.assign(ids, {
      teacher: teacher.id,
      childA: childA.id,
      childB: childB.id,
    });
  });

  afterAll(async () => {
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['DC-A1', 'DC-B1'] } } })
      .catch(() => undefined);
    // DiaryEntry.section is Restrict, so the entries created above must be cleared before the
    // school can be deleted — otherwise this delete silently no-ops (wrapped in .catch) and the
    // next run's beforeAll self-heal has to do it.
    await prisma.diaryEntry
      .deleteMany({
        where: { sectionId: { in: [ids.sectionA, ids.sectionB] } },
      })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    await prisma.circular
      .deleteMany({ where: { authorId: ids.adminUserId } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'dc-teacher@schoolos.edu.pk',
              'dc-teacher-b@schoolos.edu.pk',
              'dc-admin@schoolos.edu.pk',
              'dc-parent-a@schoolos.edu.pk',
              'dc-parent-b@schoolos.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);

    // The uploaded worksheet's File row (and its on-disk blob) has no cascade path from
    // School/Section/DiaryEntry, so it must be cleaned up explicitly.
    if (ids.uploadedFileId) {
      const fileRecord = await prisma.file
        .findUnique({ where: { id: ids.uploadedFileId } })
        .catch(() => null);
      if (fileRecord) {
        await storage.delete(fileRecord.storageKey).catch(() => undefined);
      }
      await prisma.file
        .deleteMany({ where: { id: ids.uploadedFileId } })
        .catch(() => undefined);
    }

    await app.close();
  });

  it("a teacher posts a diary entry, and it's visible to a parent whose child is in that section", async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    const post = await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sectionId: ids.sectionA,
        subjectId: ids.subject,
        date: today,
        text: 'کتاب صفحہ 12 مکمل کریں',
      })
      .expect(201);
    ids.diaryEntry = post.body.id;

    const parentToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const month = today.slice(0, 7);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/diary?month=${month}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subject: 'DC Urdu',
          text: 'کتاب صفحہ 12 مکمل کریں',
        }),
      ]),
    );
  });

  it("a parent in a different section does NOT see another section's diary entry", async () => {
    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    const month = new Date().toISOString().slice(0, 7);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/diary?month=${month}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('a SCHOOL_ADMIN (no Teacher profile row) can post a diary entry end-to-end, authored as themself', async () => {
    const adminToken = await loginAs('dc-admin@schoolos.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    // Uses sectionB/childB (untouched by the other diary tests in this file) so this test is fully
    // independent of the upsert-on-sectionId+subjectId+date behavior exercised elsewhere.
    const post = await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionId: ids.sectionB,
        subjectId: ids.subject,
        date: today,
        text: 'Admin-posted reminder: bring permission slips.',
      })
      .expect(201);

    expect(post.body.authorId).toBe(ids.adminUserId);

    // Visible via the section endpoint (also admin/teacher-only), proving the row round-trips.
    const sectionView = await request(app.getHttpServer())
      .get(`/api/v1/sections/${ids.sectionB}/diary?month=${today.slice(0, 7)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(sectionView.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Admin-posted reminder: bring permission slips.',
        }),
      ]),
    );

    // And visible to the parent whose child is in that section.
    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    const parentView = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/diary?month=${today.slice(0, 7)}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);
    expect(parentView.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Admin-posted reminder: bring permission slips.',
        }),
      ]),
    );
  });

  it('a PARENT cannot post a diary entry', async () => {
    const parentToken = await loginAs('dc-parent-a@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        sectionId: ids.sectionA,
        subjectId: ids.subject,
        date: new Date().toISOString().slice(0, 10),
        text: 'x',
      })
      .expect(403);
  });

  it('denies a teacher creating a diary entry for a section outside their campus', async () => {
    const token = await loginAs('dc-teacher-b@schoolos.edu.pk');
    const res = await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sectionId: ids.sectionA,
        subjectId: ids.subject,
        date: '2026-09-12',
        text: 'Test entry',
      });
    expect(res.status).toBe(403);
  });

  it("denies a teacher reading another campus section's diary", async () => {
    const token = await loginAs('dc-teacher-b@schoolos.edu.pk');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/sections/${ids.sectionA}/diary`)
      .query({ month: '2026-09' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('an admin publishes a school-wide circular; both parents get it, and stats show delivered/read counts', async () => {
    const adminToken = await loginAs('dc-admin@schoolos.edu.pk');

    const publish = await request(app.getHttpServer())
      .post('/api/v1/circulars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'PTM', description: 'PTM in September.', scope: 'school' })
      .expect(201);
    ids.schoolCircular = publish.body.id;

    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const inboxA = await request(app.getHttpServer())
      .get('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(inboxA.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.schoolCircular, readAt: null }),
      ]),
    );

    // Prove the OTHER fixture parent got it too — not just an aggregate delivered count,
    // which a static seed-data floor could satisfy even if dc-parent-b were never included.
    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    const inboxB = await request(app.getHttpServer())
      .get('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);
    expect(inboxB.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.schoolCircular, readAt: null }),
      ]),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/circulars/${ids.schoolCircular}/read`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(201);

    const stats = await request(app.getHttpServer())
      .get(`/api/v1/circulars/${ids.schoolCircular}/stats`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(stats.body.delivered).toBeGreaterThanOrEqual(2);
    expect(stats.body.read).toBe(1);
  });

  it("a section-scoped circular only reaches that section's parent", async () => {
    const adminToken = await loginAs('dc-admin@schoolos.edu.pk');

    const publish = await request(app.getHttpServer())
      .post('/api/v1/circulars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Field trip',
        description: 'DC-A only.',
        scope: 'section',
        sectionId: ids.sectionA,
      })
      .expect(201);

    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const inboxA = await request(app.getHttpServer())
      .get('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(inboxA.body.map((c: { id: string }) => c.id)).toContain(
      publish.body.id,
    );

    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    const inboxB = await request(app.getHttpServer())
      .get('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);
    expect(inboxB.body.map((c: { id: string }) => c.id)).not.toContain(
      publish.body.id,
    );
  });

  it("a PARENT cannot publish a circular or read another circular's stats", async () => {
    const parentToken = await loginAs('dc-parent-a@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/circulars')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ title: 'x', description: 'x', scope: 'school' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/circulars/${ids.schoolCircular}/stats`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);
  });

  it('a file attached to a diary entry is downloadable by an entitled parent (header or query-token auth) and forbidden to an unentitled one', async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');

    const upload = await request(app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', Buffer.from('worksheet contents'), 'worksheet.txt')
      .expect(201);
    const fileId = upload.body.id as string;
    ids.uploadedFileId = fileId;

    // file.upload must be audited (design spec: every write gets an AuditLog row).
    const uploadAudit = await prisma.auditLog.findFirst({
      where: { action: 'file.upload', entity: 'File', entityId: fileId },
    });
    expect(uploadAudit).not.toBeNull();

    const today = new Date().toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post('/api/v1/diary')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        sectionId: ids.sectionA,
        subjectId: ids.subject,
        date: today,
        text: 'See attached worksheet.',
        fileIds: [fileId],
      })
      .expect(201);

    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');
    const download = await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(download.text).toBe('worksheet contents');
    // Must be forced as a download (never inline) and marked nosniff — an attacker-controlled
    // mimetype must never render as a page on this token-bearing origin.
    expect(download.headers['content-disposition']).toMatch(/^attachment;/);
    expect(download.headers['x-content-type-options']).toBe('nosniff');

    // Same download, authenticated via ?access_token= instead of a header — proves a plain
    // download link (which can't set headers) still works.
    const viaQuery = await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}?access_token=${parentAToken}`)
      .expect(200);
    expect(viaQuery.text).toBe('worksheet contents');

    const parentBToken = await loginAs('dc-parent-b@schoolos.edu.pk');
    await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(403);
  });

  it('rejects a file upload larger than the configured size limit', async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);

    await request(app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', oversized, 'huge.pdf')
      .expect(413);
  });

  it('rejects an upload with a blocked executable extension', async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', Buffer.from('not really an installer'), 'setup.exe')
      .expect(400);
  });

  it('the ?access_token= query fallback authenticates the files route but not other routes', async () => {
    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/me/children?access_token=${parentAToken}`)
      .expect(401);
  });
});
