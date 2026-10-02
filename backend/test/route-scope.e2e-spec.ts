import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * KG-16 (and the gaps it found): routes that rely on service-level scoping. Hiring applications,
 * admission applications and the timetable were reachable across schools by id; candidate and
 * applicant lookups returned other schools' people. Each case below is a school-B admin acting on
 * school A's records (403, or an empty lookup), with the school-A admin as the positive control.
 */
describe('Route scope (e2e, KG-16)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const PHONE = '0300-1616160';
  let classA: string;
  let classB: string;
  let subjectA: string;
  let teacherA: string;
  let teacherB: string;
  let entryA: string;
  let hiringA: string;
  let candidateA: string;
  let admissionA: string;
  let applicantA: string;

  beforeAll(async () => {
    f = await createTwoSchools('kg16');
    for (const who of ['super', 'admin-a', 'admin-b']) {
      tokens[who] = await f.login(who);
    }
    const section = (id: string) =>
      f.prisma.section.findUniqueOrThrow({
        where: { id },
        select: { classId: true },
      });
    classA = (await section(f.ids.sectionA)).classId;
    classB = (await section(f.ids.sectionB)).classId;
    const teacher = (tag: string) =>
      f.prisma.teacher.findFirstOrThrow({
        where: { user: { identifier: `kg16-teacher-${tag}` } },
        select: { id: true },
      });
    teacherA = (await teacher('a')).id;
    teacherB = (await teacher('b')).id;
    subjectA = (
      await f.prisma.subject.create({
        data: { name: 'KG16 Maths', schoolId: f.ids.schoolA },
      })
    ).id;
    entryA = (
      await f.prisma.timetable.create({
        data: {
          sectionId: f.ids.sectionA,
          subjectId: subjectA,
          dayOfWeek: 1,
          period: 1,
          startTime: '08:00',
          endTime: '08:40',
        },
      })
    ).id;
  });

  afterAll(async () => {
    try {
      await f.prisma.timetable.deleteMany({
        where: { subject: { name: { startsWith: 'KG16 ' } } },
      });
      await f.prisma.subject.deleteMany({
        where: { name: { startsWith: 'KG16 ' } },
      });
      await f.prisma.hiringApplication.deleteMany({
        where: { candidate: { contactPhone: PHONE } },
      });
      await f.prisma.hiringCandidate.deleteMany({
        where: { contactPhone: PHONE },
      });
      await f.prisma.application.deleteMany({
        where: { applicant: { guardianPhone: PHONE } },
      });
      await f.prisma.applicant.deleteMany({ where: { guardianPhone: PHONE } });
    } finally {
      await f.close();
    }
  });

  describe('timetable', () => {
    const slot = {
      subjectId: '',
      dayOfWeek: 2,
      period: 3,
      startTime: '09:00',
      endTime: '09:40',
    };

    it('another school’s admin cannot read, replace, add, edit or delete it', async () => {
      await http()
        .get(`/api/v1/sections/${f.ids.sectionA}/timetable`)
        .set(as('admin-a'))
        .expect(200);
      await http()
        .get(`/api/v1/sections/${f.ids.sectionA}/timetable`)
        .set(as('admin-b'))
        .expect(403);
      await http()
        .put(`/api/v1/sections/${f.ids.sectionA}/timetable`)
        .set(as('admin-b'))
        .send({ entries: [] })
        .expect(403);
      await http()
        .post('/api/v1/timetable')
        .set(as('admin-b'))
        .send({ ...slot, subjectId: subjectA, sectionId: f.ids.sectionA })
        .expect(403);
      await http()
        .patch(`/api/v1/timetable/${entryA}`)
        .set(as('admin-b'))
        .send({ room: 'B-1' })
        .expect(403);
      await http()
        .delete(`/api/v1/timetable/${entryA}`)
        .set(as('admin-b'))
        .expect(403);
      expect(
        await f.prisma.timetable.count({
          where: { sectionId: f.ids.sectionA },
        }),
      ).toBe(1);
    });

    it('a teacher from another campus cannot be placed on the section', async () => {
      await http()
        .post('/api/v1/timetable')
        .set(as('super'))
        .send({
          ...slot,
          subjectId: subjectA,
          sectionId: f.ids.sectionA,
          teacherId: teacherB,
        })
        .expect(400);
      await http()
        .patch(`/api/v1/timetable/${entryA}`)
        .set(as('admin-a'))
        .send({ teacherId: teacherB })
        .expect(400);
      await http()
        .patch(`/api/v1/timetable/${entryA}`)
        .set(as('admin-a'))
        .send({ teacherId: teacherA })
        .expect(200);
    });
  });

  describe('hiring', () => {
    it('school A creates a candidate and an application on its campus', async () => {
      const cand = await http()
        .post('/api/v1/hiring/candidates')
        .set(as('admin-a'))
        .send({ name: 'KG16 Candidate', contactPhone: PHONE })
        .expect(201);
      candidateA = cand.body.candidate.id;
      const app = await http()
        .post('/api/v1/hiring/applications')
        .set(as('admin-a'))
        .send({
          candidateId: candidateA,
          employeeType: 'GUARD',
          campusId: f.ids.campusA,
        })
        .expect(201);
      hiringA = app.body.id;
    });

    it('school B cannot file an application on school A’s campus or for its candidate', async () => {
      await http()
        .post('/api/v1/hiring/applications')
        .set(as('admin-b'))
        .send({
          candidateId: candidateA,
          employeeType: 'GUARD',
          campusId: f.ids.campusA,
        })
        .expect(403);
      await http()
        .post('/api/v1/hiring/applications')
        .set(as('admin-b'))
        .send({
          candidateId: candidateA,
          employeeType: 'GUARD',
          campusId: f.ids.campusB,
        })
        .expect(404);
    });

    it('school B cannot read, change, reject or approve school A’s application', async () => {
      const base = `/api/v1/hiring/applications/${hiringA}`;
      await http().get(base).set(as('admin-a')).expect(200);
      await http().get(base).set(as('admin-b')).expect(403);
      await http()
        .patch(base)
        .set(as('admin-b'))
        .send({ status: 'SHORTLISTED' })
        .expect(403);
      await http()
        .post(`${base}/reject`)
        .set(as('admin-b'))
        .send({ decisionNotes: 'no' })
        .expect(403);
      await http()
        .post(`${base}/approve`)
        .set(as('admin-b'))
        .send({})
        .expect(403);
      const row = await f.prisma.hiringApplication.findUniqueOrThrow({
        where: { id: hiringA },
      });
      expect(row.status).toBe('SUBMITTED');
    });

    it('the candidate lookup shows school A’s candidate to school A only', async () => {
      const own = await http()
        .get(`/api/v1/hiring/candidates?contactPhone=${PHONE}`)
        .set(as('admin-a'))
        .expect(200);
      expect(own.body.map((c: { id: string }) => c.id)).toContain(candidateA);
      const other = await http()
        .get(`/api/v1/hiring/candidates?contactPhone=${PHONE}`)
        .set(as('admin-b'))
        .expect(200);
      expect(other.body).toEqual([]);
    });

    it('a candidate school A recorded but has not applied for yet stays hidden from school B', async () => {
      const orphan = await http()
        .post('/api/v1/hiring/candidates')
        .set(as('admin-a'))
        .send({ name: 'KG16 Orphan', contactPhone: PHONE })
        .expect(201);
      const dup = await http()
        .post('/api/v1/hiring/candidates')
        .set(as('admin-b'))
        .send({ name: 'KG16 Orphan', contactPhone: PHONE })
        .expect(201);
      expect(dup.body.possibleDuplicate).toBeNull();
      const own = await http()
        .post('/api/v1/hiring/candidates')
        .set(as('admin-a'))
        .send({ name: 'KG16 Orphan', contactPhone: PHONE })
        .expect(201);
      expect(own.body.possibleDuplicate?.id).toBe(orphan.body.candidate.id);
      await http()
        .post('/api/v1/hiring/applications')
        .set(as('admin-b'))
        .send({
          candidateId: orphan.body.candidate.id,
          employeeType: 'GUARD',
          campusId: f.ids.campusB,
        })
        .expect(404);
    });
  });

  describe('admissions', () => {
    it('school A records an applicant and an application to its class', async () => {
      const ap = await http()
        .post('/api/v1/applicants')
        .set(as('admin-a'))
        .send({
          name: 'KG16 Child',
          dateOfBirth: '2018-04-01',
          guardianName: 'KG16 Guardian',
          guardianPhone: PHONE,
        })
        .expect(201);
      applicantA = ap.body.applicant.id;
      const app = await http()
        .post('/api/v1/applications')
        .set(as('admin-a'))
        .send({
          applicantId: applicantA,
          desiredClassId: classA,
          academicSessionId: f.ids.sessionA,
        })
        .expect(201);
      admissionA = app.body.id;
    });

    it('school B cannot apply to school A’s class, nor mix in school A’s session or applicant', async () => {
      await http()
        .post('/api/v1/applications')
        .set(as('admin-b'))
        .send({
          applicantId: applicantA,
          desiredClassId: classA,
          academicSessionId: f.ids.sessionA,
        })
        .expect(403);
      await http()
        .post('/api/v1/applications')
        .set(as('super'))
        .send({
          applicantId: applicantA,
          desiredClassId: classB,
          academicSessionId: f.ids.sessionA,
        })
        .expect(400);
      await http()
        .post('/api/v1/applications')
        .set(as('admin-b'))
        .send({
          applicantId: applicantA,
          desiredClassId: classB,
          academicSessionId: f.ids.sessionB,
        })
        .expect(404);
    });

    it('school B cannot read, change, reject or approve school A’s application', async () => {
      const base = `/api/v1/applications/${admissionA}`;
      await http().get(base).set(as('admin-a')).expect(200);
      await http().get(base).set(as('admin-b')).expect(403);
      await http()
        .patch(base)
        .set(as('admin-b'))
        .send({ status: 'UNDER_REVIEW' })
        .expect(403);
      await http()
        .post(`${base}/reject`)
        .set(as('admin-b'))
        .send({ decisionNotes: 'no' })
        .expect(403);
      await http()
        .post(`${base}/approve`)
        .set(as('admin-b'))
        .send({})
        .expect(403);
    });

    it('school A cannot approve its application into school B’s section', async () => {
      await http()
        .post(`/api/v1/applications/${admissionA}/approve`)
        .set(as('admin-a'))
        .send({
          sectionId: f.ids.sectionB,
          grNumber: 'KG16-X1',
          parentProfileId: f.ids.parentA,
          relationshipType: 'FATHER',
        })
        .expect(403);
      const row = await f.prisma.application.findUniqueOrThrow({
        where: { id: admissionA },
      });
      expect(row.status).toBe('SUBMITTED');
    });

    it('the applicant lookup shows school A’s applicant to school A only', async () => {
      const own = await http()
        .get(`/api/v1/applicants?guardianPhone=${PHONE}`)
        .set(as('admin-a'))
        .expect(200);
      expect(own.body.map((a: { id: string }) => a.id)).toContain(applicantA);
      const other = await http()
        .get(`/api/v1/applicants?guardianPhone=${PHONE}`)
        .set(as('admin-b'))
        .expect(200);
      expect(other.body).toEqual([]);
    });
  });
});
