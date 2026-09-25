import request from 'supertest';
import {
  createTwoSchools,
  PASSWORD,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-07 + BL-63 (M9, Q7, RD-6): archive instead of hard delete, SUPER_ADMIN-only erasure, the
 * retention settings/report (never deletes) — and the record-scope guard that confines the
 * student, staff and teacher routes to the caller's school (found while doing BL-07).
 */
describe('Archive, erasure and retention (e2e, BL-07/BL-63)', () => {
  let f: TwoSchools;
  let adminA: string;
  let adminB: string;
  let superAdmin: string;
  let teacherA: string;
  let staffA: string;
  const http = () => request(f.app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    f = await createTwoSchools('bl07');
    [adminA, adminB, superAdmin] = await Promise.all([
      f.login('admin-a'),
      f.login('admin-b'),
      f.login('super'),
    ]);
    teacherA = (
      await f.prisma.teacher.findFirstOrThrow({
        where: { name: 'BL07 Teacher A' },
      })
    ).id;
    staffA = (
      await f.prisma.staff.create({
        data: {
          name: 'BL07 Clerk',
          employeeType: 'OFFICE_STAFF',
          campusId: f.ids.campusA,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await f.prisma.retentionPolicy.updateMany({
      data: { periodMonths: null, legalBasis: null },
    });
    await f.prisma.staff.deleteMany({ where: { name: 'BL07 Clerk' } });
    await f.close();
  });

  describe('record scope (another school gets 403)', () => {
    it('student profile, edit and delete', async () => {
      await http()
        .get(`/api/v1/admin/students/${f.ids.studentA}/profile`)
        .set(auth(adminB))
        .expect(403);
      await http()
        .get(`/api/v1/admin/students/${f.ids.studentA}/medical`)
        .set(auth(adminB))
        .expect((r) => {
          expect([403, 404]).toContain(r.status); // route may not exist; never 200
        });
      await http()
        .patch(`/api/v1/admin/students/${f.ids.studentA}`)
        .set(auth(adminB))
        .send({ name: 'x' })
        .expect(403);
      await http()
        .delete(`/api/v1/admin/students/${f.ids.studentA}`)
        .set(auth(adminB))
        .expect(403);
      await http()
        .get(`/api/v1/admin/students/${f.ids.studentA}/profile`)
        .set(auth(adminA))
        .expect(200);
    });

    it('teacher password reset and staff profile', async () => {
      await http()
        .patch(`/api/v1/admin/teachers/${teacherA}`)
        .set(auth(adminB))
        .send({ password: 'Takeover-Password-1!' })
        .expect(403);
      await http()
        .get(`/api/v1/admin/staff/${staffA}/profile`)
        .set(auth(adminB))
        .expect(403);
      await http()
        .delete(`/api/v1/admin/staff/${staffA}`)
        .set(auth(adminB))
        .expect(403);
      await http()
        .get(`/api/v1/admin/staff/${staffA}/profile`)
        .set(auth(adminA))
        .expect(200);
    });
  });

  describe('students', () => {
    it('DELETE archives: enrolment WITHDRAWN, out of the list, still readable, audited', async () => {
      const id = f.ids.studentANoTeacher;
      await http()
        .delete(`/api/v1/admin/students/${id}?reason=Left%20the%20city`)
        .set(auth(adminA))
        .expect(200);
      const s = await f.prisma.student.findUniqueOrThrow({
        where: { id },
        include: { enrollments: true },
      });
      expect(s.archivedAt).not.toBeNull();
      expect(s.archiveReason).toBe('Left the city');
      expect(s.status).toBe('WITHDRAWN');
      expect(s.enrollments.map((e) => e.status)).toEqual(['WITHDRAWN']);

      const active = await http()
        .get('/api/v1/admin/students')
        .set(auth(adminA))
        .expect(200);
      expect(active.body.map((r: { id: string }) => r.id)).not.toContain(id);
      const archived = await http()
        .get('/api/v1/admin/students?archived=true')
        .set(auth(adminA))
        .expect(200);
      expect(archived.body.map((r: { id: string }) => r.id)).toEqual([id]);
      await http()
        .get(`/api/v1/admin/students/${id}/profile`)
        .set(auth(adminA))
        .expect(200);
      expect(
        await f.prisma.auditLog.count({
          where: { action: 'student.archive', entityId: id },
        }),
      ).toBe(1);
      await http()
        .delete(`/api/v1/admin/students/${id}`)
        .set(auth(adminA))
        .expect(409);
    });

    it('unarchive brings the record back into the list', async () => {
      const id = f.ids.studentANoTeacher;
      await http()
        .post(`/api/v1/admin/students/${id}/unarchive`)
        .set(auth(adminA))
        .expect(204);
      const active = await http()
        .get('/api/v1/admin/students')
        .set(auth(adminA))
        .expect(200);
      expect(active.body.map((r: { id: string }) => r.id)).toContain(id);
      await http()
        .post(`/api/v1/admin/students/${id}/archive`)
        .set(auth(adminA))
        .send({ reason: 'again' })
        .expect(201);
    });

    it('erasure: school admin 403, not archived 409, super admin erases an archived record (audited)', async () => {
      const id = f.ids.studentANoTeacher;
      await http()
        .post(`/api/v1/admin/students/${id}/erase`)
        .set(auth(adminA))
        .expect(403);
      await http()
        .post(`/api/v1/admin/students/${f.ids.studentA}/erase`)
        .set(auth(superAdmin))
        .expect(409);
      await http()
        .post(`/api/v1/admin/students/${id}/erase`)
        .set(auth(superAdmin))
        .expect(204);
      expect(await f.prisma.student.findUnique({ where: { id } })).toBeNull();
      expect(
        await f.prisma.auditLog.count({
          where: { action: 'student.erase', entityId: id },
        }),
      ).toBe(1);
    });
  });

  describe('teachers and staff', () => {
    it('DELETE of a teacher archives: out of the list, off the class, login disabled', async () => {
      await http()
        .delete(`/api/v1/admin/teachers/${teacherA}`)
        .set(auth(adminA))
        .expect(200);
      const t = await f.prisma.teacher.findUniqueOrThrow({
        where: { id: teacherA },
        include: { user: true },
      });
      expect(t.archivedAt).not.toBeNull();
      expect(t.user.isLocked).toBe(true);
      const section = await f.prisma.section.findUniqueOrThrow({
        where: { id: f.ids.sectionA },
      });
      expect(section.classTeacherId).toBeNull();
      const list = await http()
        .get('/api/v1/admin/teachers')
        .set(auth(adminA))
        .expect(200);
      expect(list.body.map((r: { id: string }) => r.id)).not.toContain(
        teacherA,
      );
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: 'bl07-teacher-a', password: PASSWORD });
      expect(login.status).not.toBe(201);
      // teaching history end-dated by the M8 triggers
      const open = await f.prisma.teachingAssignment.count({
        where: { teacherId: teacherA, endDate: null },
      });
      expect(open).toBe(0);
    });

    it('erasure of an archived teacher is refused while records reference them (retention), and allowed for super admin only', async () => {
      await f.prisma.attendance.create({
        data: {
          studentId: f.ids.studentA,
          date: new Date('2026-02-02'),
          status: 'PRESENT',
          markedById: teacherA,
        },
      });
      await http()
        .post(`/api/v1/admin/teachers/${teacherA}/erase`)
        .set(auth(adminA))
        .expect(403);
      await http()
        .post(`/api/v1/admin/teachers/${teacherA}/erase`)
        .set(auth(superAdmin))
        .expect(400);
      expect(
        await f.prisma.teacher.findUnique({ where: { id: teacherA } }),
      ).not.toBeNull();
      await f.prisma.attendance.updateMany({
        where: { markedById: teacherA },
        data: { markedById: null },
      });
    });

    it('DELETE of a staff member archives; archived=true lists it', async () => {
      await http()
        .delete(`/api/v1/admin/staff/${staffA}`)
        .set(auth(adminA))
        .expect(200);
      expect(
        (await f.prisma.staff.findUniqueOrThrow({ where: { id: staffA } }))
          .archivedAt,
      ).not.toBeNull();
      const active = await http()
        .get('/api/v1/admin/staff')
        .set(auth(adminA))
        .expect(200);
      expect(active.body.map((r: { id: string }) => r.id)).not.toContain(
        staffA,
      );
      const archived = await http()
        .get('/api/v1/admin/staff?archived=true')
        .set(auth(adminA))
        .expect(200);
      expect(archived.body.map((r: { id: string }) => r.id)).toContain(staffA);
    });
  });

  describe('retention policy (BL-63)', () => {
    it('every category exists with the period unset; only a super admin sees it', async () => {
      await http()
        .get('/api/v1/admin/retention-policy')
        .set(auth(adminA))
        .expect(403);
      const res = await http()
        .get('/api/v1/admin/retention-policy')
        .set(auth(superAdmin))
        .expect(200);
      expect(res.body).toHaveLength(11);
      expect(
        res.body.every(
          (r: { periodMonths: number | null }) => r.periodMonths === null,
        ),
      ).toBe(true);
    });

    it('setting a period is audited and the report counts without deleting anything', async () => {
      await f.prisma.attendance.create({
        data: {
          studentId: f.ids.studentA,
          date: new Date('2020-01-06'),
          status: 'PRESENT',
        },
      });
      const before = await f.prisma.attendance.count();
      await http()
        .put('/api/v1/admin/retention-policy/ATTENDANCE')
        .set(auth(superAdmin))
        .send({ periodMonths: 12, legalBasis: 'test only' })
        .expect(200);
      await http()
        .put('/api/v1/admin/retention-policy/NOPE')
        .set(auth(superAdmin))
        .send({ periodMonths: 1 })
        .expect(400);
      await http()
        .put('/api/v1/admin/retention-policy/ATTENDANCE')
        .set(auth(superAdmin))
        .send({ periodMonths: 0 })
        .expect(400);
      const report = await http()
        .get('/api/v1/admin/retention-policy/report')
        .set(auth(superAdmin))
        .expect(200);
      const att = report.body.find(
        (r: { category: string }) => r.category === 'ATTENDANCE',
      );
      expect(att.recordsPastPeriod).toBeGreaterThanOrEqual(1);
      const unset = report.body.find(
        (r: { category: string }) => r.category === 'STUDENT',
      );
      expect(unset.recordsPastPeriod).toBeNull();
      expect(await f.prisma.attendance.count()).toBe(before);
      expect(
        await f.prisma.auditLog.count({
          where: { action: 'retention-policy.update', entityId: 'ATTENDANCE' },
        }),
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
