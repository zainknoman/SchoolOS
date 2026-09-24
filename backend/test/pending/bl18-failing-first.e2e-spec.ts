import request from 'supertest';
import { createTwoSchools, pending, TwoSchools } from './two-school-fixture';

/**
 * BL-18 scaffold: failing-first e2e tests for BL-20, BL-01, BL-23, BL-60, BL-29 and BL-64.
 * Every test states the TARGET behaviour from docs/product/requirements/BACKLOG.md and is expected
 * to FAIL today for the reason in its comment (see two-school-fixture.ts for how `pending` works).
 * When an item is implemented, move its tests into the regular suite as plain `it`.
 */
describe('BL-18 failing-first scaffold (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());

  beforeAll(async () => {
    f = await createTwoSchools('bl18');
    for (const who of ['super', 'admin-a', 'admin-b', 'parent-a', 'parent-b']) {
      tokens[who] = await f.login(who);
    }
  });

  afterAll(async () => {
    await f.close();
  });

  describe('BL-60 attendance without a class teacher', () => {
    // Today: 400 "this student's section has no class teacher assigned" — Attendance.markedById is
    // a required Teacher FK and an admin has no Teacher profile (attendance.service.ts).
    pending(
      'a SCHOOL_ADMIN marks attendance in a section with no class teacher; the row names the admin',
      async () => {
        const res = await http()
          .post('/api/v1/attendance')
          .set('Authorization', `Bearer ${tokens['admin-a']}`)
          .send({
            studentId: f.ids.studentANoTeacher,
            date: '2026-02-02',
            status: 'PRESENT',
          });
        expect(res.status).toBe(201);
        const row = await f.prisma.attendance.findUniqueOrThrow({
          where: { id: res.body.id },
        });
        expect(row).toMatchObject({ markedById: null });
        expect((row as Record<string, unknown>).markedByUserId).toBeDefined();
      },
    );
  });

  describe('BL-29 leave approval without a class teacher', () => {
    // Today: 400 "Cannot approve leave: this student's section has no class teacher assigned".
    pending(
      'a SCHOOL_ADMIN approves leave for a student whose section has no class teacher',
      async () => {
        const created = await http()
          .post('/api/v1/leave-requests')
          .set('Authorization', `Bearer ${tokens['parent-a']}`)
          .send({
            studentId: f.ids.studentANoTeacher,
            startDate: '2026-02-10',
            endDate: '2026-02-10',
            reason: 'Fever',
          })
          .expect(201);
        const res = await http()
          .post(`/api/v1/leave-requests/${created.body.id}/approve`)
          .set('Authorization', `Bearer ${tokens['admin-a']}`);
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('approved');
      },
    );
  });

  describe('BL-20 circulars and holidays stay inside their school', () => {
    // Today: a school-scope circular is delivered to EVERY parent user (circulars.service.ts).
    pending(
      "school A's school-wide circular is not delivered to a parent of school B",
      async () => {
        const pub = await http()
          .post('/api/v1/circulars')
          .set('Authorization', `Bearer ${tokens['admin-a']}`)
          .send({
            title: 'BL18 A notice',
            description: 'School A only',
            scope: 'school',
          })
          .expect(201);
        const res = await http()
          .get('/api/v1/circulars')
          .set('Authorization', `Bearer ${tokens['parent-b']}`)
          .expect(200);
        expect((res.body as { id: string }[]).map((c) => c.id)).not.toContain(
          pub.body.id,
        );
      },
    );

    // Today: a holiday with no campus has no school and is returned to every school's users.
    pending(
      "school A's school-wide holiday is not visible to a parent of school B",
      async () => {
        const hol = await http()
          .post('/api/v1/holidays')
          .set('Authorization', `Bearer ${tokens['admin-a']}`)
          .send({
            title: 'BL18 A holiday',
            startDate: '2026-03-02',
            endDate: '2026-03-02',
          })
          .expect(201);
        const res = await http()
          .get('/api/v1/holidays')
          .set('Authorization', `Bearer ${tokens['parent-b']}`)
          .expect(200);
        expect((res.body as { id: string }[]).map((h) => h.id)).not.toContain(
          hol.body.id,
        );
      },
    );
  });

  describe('BL-23 guardian across schools', () => {
    // Today: GET /admin/parents/:id returns ALL of the parent's children, including other schools'.
    pending(
      "school B's admin sees only school B's children of a parent shared with school A",
      async () => {
        const res = await http()
          .get(`/api/v1/admin/parents/${f.ids.parentShared}`)
          .set('Authorization', `Bearer ${tokens['admin-b']}`)
          .expect(200);
        const childIds = (
          res.body.children as { studentId?: string; id?: string }[]
        ).map((c) => c.studentId ?? c.id);
        expect(childIds).toContain(f.ids.studentB);
        expect(childIds).not.toContain(f.ids.studentA);
      },
    );
  });

  describe('BL-64 admin-assisted parent password reset', () => {
    // Today: 404 — the endpoint does not exist (depends on BL-21 server-side mustChangePassword).
    pending(
      'a SCHOOL_ADMIN issues a one-time password; the parent must change it at next login',
      async () => {
        const res = await http()
          .post(`/api/v1/admin/parents/${f.ids.parentA}/reset-password`)
          .set('Authorization', `Bearer ${tokens['admin-a']}`);
        expect(res.status).toBe(201);
        expect(typeof res.body.temporaryPassword).toBe('string');
        const u = await f.prisma.user.findUniqueOrThrow({
          where: { id: f.ids.parentAUser },
        });
        expect(u.mustChangePassword).toBe(true);
      },
    );
  });

  describe('BL-01 school-scoped academic sessions', () => {
    // Today: activating any session deactivates every other session in every school (global flag).
    // Kept last: it changes the active flags the other tests do not depend on.
    pending(
      "activating school A's session leaves school B's active session active",
      async () => {
        await f.prisma.academicSession.update({
          where: { id: f.ids.sessionA },
          data: { isActive: false },
        });
        await http()
          .patch(`/api/v1/academic-sessions/${f.ids.sessionA}`)
          .set('Authorization', `Bearer ${tokens.super}`)
          .send({ isActive: true })
          .expect(200);
        const b = await f.prisma.academicSession.findUniqueOrThrow({
          where: { id: f.ids.sessionB },
        });
        expect(b.isActive).toBe(true);
      },
    );
  });
});
