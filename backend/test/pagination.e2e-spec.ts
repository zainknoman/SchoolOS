import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/** BL-40: paged + searchable list endpoints; array bodies unchanged, totals in headers. */
describe('Pagination (e2e)', () => {
  let f: TwoSchools;
  let adminA: string;
  let adminB: string;
  const http = () => request(f.app.getHttpServer());

  beforeAll(async () => {
    f = await createTwoSchools('bl40');
    const enrollment = await f.prisma.enrollment.findFirstOrThrow({
      where: { studentId: f.ids.studentA },
    });
    // 30 more students in school A: "BL40 Pupil 01".."30".
    for (let i = 1; i <= 30; i++) {
      const n = String(i).padStart(2, '0');
      const s = await f.prisma.student.create({
        data: { grNumber: `BL40-P${n}`, name: `BL40 Pupil ${n}` },
      });
      await f.prisma.enrollment.create({
        data: {
          studentId: s.id,
          campusId: enrollment.campusId,
          sectionId: enrollment.sectionId,
          academicSessionId: enrollment.academicSessionId,
          startDate: enrollment.startDate,
          status: 'ACTIVE',
        },
      });
    }
    adminA = await f.login('admin-a');
    adminB = await f.login('admin-b');
  });
  afterAll(async () => {
    await f.close();
  });

  const students = (token: string, query: string) =>
    http()
      .get(`/api/v1/admin/students${query}`)
      .set('Authorization', `Bearer ${token}`);

  it('serves a page with total, page and limit headers; the body is still an array', async () => {
    const res = await students(adminA, '?page=1&limit=10&q=BL40 Pupil').expect(
      200,
    );
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);
    expect(res.headers['x-total-count']).toBe('30');
    expect(res.headers['x-page']).toBe('1');
    expect(res.headers['x-limit']).toBe('10');
    expect((res.body as { name: string }[])[0].name).toBe('BL40 Pupil 01');

    const last = await students(adminA, '?page=3&limit=10&q=BL40 Pupil').expect(
      200,
    );
    expect((last.body as { name: string }[]).map((s) => s.name)).toEqual(
      Array.from({ length: 10 }, (_, i) => `BL40 Pupil ${String(21 + i)}`),
    );
    const beyond = await students(
      adminA,
      '?page=9&limit=10&q=BL40 Pupil',
    ).expect(200);
    expect(beyond.body).toEqual([]);
  });

  it('searches by GR number, case-insensitively', async () => {
    const res = await students(adminA, '?q=bl40-p07').expect(200);
    expect((res.body as { grNumber: string }[]).map((s) => s.grNumber)).toEqual(
      ['BL40-P07'],
    );
    expect(res.headers['x-total-count']).toBe('1');
    expect(res.headers['x-page']).toBeUndefined();
  });

  it('keeps the school scope in both rows and counts', async () => {
    const res = await students(adminB, '?page=1&limit=100').expect(200);
    expect(res.headers['x-total-count']).toBe('1');
    expect((res.body as { id: string }[]).map((s) => s.id)).toEqual([
      f.ids.studentB,
    ]);
  });

  it('rejects an out-of-range page or limit', async () => {
    await students(adminA, '?page=0').expect(400);
    await students(adminA, '?limit=101').expect(400);
    await students(adminA, '?page=abc').expect(400);
  });

  it('an unpaged request still returns everything in scope, with the total', async () => {
    const res = await students(adminA, '').expect(200);
    expect(res.body).toHaveLength(32);
    expect(res.headers['x-total-count']).toBe('32');
    expect(res.headers['x-truncated']).toBeUndefined();
  });

  it('parents, staff, teachers and admissions accept the same parameters', async () => {
    for (const path of [
      '/api/v1/admin/parents',
      '/api/v1/admin/staff',
      '/api/v1/teachers',
      '/api/v1/applications',
      '/api/v1/hiring/applications',
    ]) {
      const res = await http()
        .get(`${path}?page=1&limit=1`)
        .set('Authorization', `Bearer ${adminA}`)
        .expect(200);
      expect(res.headers['x-limit']).toBe('1');
      expect(Number(res.headers['x-total-count'])).toBeGreaterThanOrEqual(0);
    }
    const parents = await http()
      .get('/api/v1/admin/parents?q=Parent a')
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200);
    expect((parents.body as { id: string }[]).map((p) => p.id)).toEqual([
      f.ids.parentA,
    ]);
  });
});
