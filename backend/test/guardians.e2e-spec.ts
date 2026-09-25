import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/**
 * BL-04 + BL-23 (M6): one guardian identity across schools; relationship types and at most two
 * primary guardians; each school sees and manages only its own children's links; messages and
 * circulars stay inside the child's school.
 * Fixture: parent-shared has studentA (school A) and studentB (school B).
 */
describe('Guardians across schools (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let uncleId: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl23g');
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'parent-a',
      'parent-shared',
    ])
      tokens[who] = await f.login(who);
  });
  afterAll(async () => {
    await f.prisma.circularRecipient.deleteMany({
      where: { circular: { title: { startsWith: 'BL23G' } } },
    });
    await f.prisma.circular.deleteMany({
      where: { title: { startsWith: 'BL23G' } },
    });
    await f.prisma.message.deleteMany({
      where: {
        conversation: { parentUser: { identifier: { startsWith: 'bl23g-' } } },
      },
    });
    await f.prisma.conversation.deleteMany({
      where: { parentUser: { identifier: { startsWith: 'bl23g-' } } },
    });
    await f.close();
  });

  it("school B's admin sees only school B's children of a parent shared with school A (graduated from BL-18)", async () => {
    const res = await http()
      .get(`/api/v1/admin/parents/${f.ids.parentShared}`)
      .set(as('admin-b'))
      .expect(200);
    const childIds = (res.body.children as { studentId: string }[]).map(
      (c) => c.studentId,
    );
    expect(childIds).toEqual([f.ids.studentB]);
    expect(res.body.childrenCount).toBe(1);

    const list = await http()
      .get('/api/v1/admin/parents?q=bl23g-parent-shared')
      .set(as('admin-b'))
      .expect(200);
    expect(list.body[0].childrenCount).toBe(1);
  });

  it('a shared parent profile is changed or deleted only by a super admin; own parents by their school', async () => {
    for (const who of ['admin-a', 'admin-b']) {
      await http()
        .patch(`/api/v1/admin/parents/${f.ids.parentShared}`)
        .set(as(who))
        .send({ name: 'Renamed' })
        .expect(403);
      await http()
        .delete(`/api/v1/admin/parents/${f.ids.parentShared}`)
        .set(as(who))
        .expect(403);
    }
    await http()
      .patch(`/api/v1/admin/parents/${f.ids.parentA}`)
      .set(as('admin-b'))
      .send({ name: 'Hijack' })
      .expect(403);
    await http()
      .patch(`/api/v1/admin/parents/${f.ids.parentA}`)
      .set(as('admin-a'))
      .send({ phone: '0300-0000001' })
      .expect(200);
    await http()
      .patch(`/api/v1/admin/parents/${f.ids.parentShared}`)
      .set(as('super'))
      .send({ phone: '0300-0000002' })
      .expect(200);
  });

  it("an admin cannot change another school's link of a shared parent", async () => {
    await http()
      .patch(
        `/api/v1/admin/parents/${f.ids.parentShared}/children/${f.ids.studentA}`,
      )
      .set(as('admin-b'))
      .send({ isEmergencyContact: true })
      .expect(403);
  });

  it('at most two primary guardians per student; relationship types; link and unlink', async () => {
    const a1 = await http()
      .patch(
        `/api/v1/admin/parents/${f.ids.parentA}/children/${f.ids.studentA}`,
      )
      .set(as('admin-a'))
      .send({ isPrimary: true, relationshipType: 'MOTHER' })
      .expect(200);
    const linkA = (
      a1.body.children as {
        studentId: string;
        primarySlot: number;
        relationshipType: string;
      }[]
    ).find((c) => c.studentId === f.ids.studentA)!;
    expect(linkA).toMatchObject({
      primarySlot: 1,
      relationshipType: 'MOTHER',
      isPrimary: true,
    });

    await http()
      .patch(
        `/api/v1/admin/parents/${f.ids.parentShared}/children/${f.ids.studentA}`,
      )
      .set(as('admin-a'))
      .send({ isPrimary: true, relationshipType: 'FATHER' })
      .expect(200);

    // A third guardian: a new parent of school A, linked as "Uncle".
    uncleId = (
      await http()
        .post('/api/v1/admin/parents')
        .set(as('admin-a'))
        .send({
          identifier: 'bl23g-uncle',
          password: 'Uncle-Pass-123!',
          name: 'BL23G Uncle',
        })
        .expect(201)
    ).body.id;
    await http()
      .post(`/api/v1/admin/parents/${uncleId}/children`)
      .set(as('admin-a'))
      .send({
        studentId: f.ids.studentA,
        relationshipType: 'OTHER',
        relationshipNote: 'Uncle',
        isPrimary: true,
      })
      .expect(409);
    await http()
      .post(`/api/v1/admin/parents/${uncleId}/children`)
      .set(as('admin-a'))
      .send({ studentId: f.ids.studentA, relationshipType: 'COUSIN' })
      .expect(400);
    const linked = await http()
      .post(`/api/v1/admin/parents/${uncleId}/children`)
      .set(as('admin-a'))
      .send({
        studentId: f.ids.studentA,
        relationshipType: 'OTHER',
        relationshipNote: 'Uncle',
      })
      .expect(201);
    expect(linked.body.children[0]).toMatchObject({
      relationshipType: 'OTHER',
      relationshipNote: 'Uncle',
      primarySlot: null,
    });
    // Releasing a primary frees its slot for the uncle.
    await http()
      .patch(
        `/api/v1/admin/parents/${f.ids.parentA}/children/${f.ids.studentA}`,
      )
      .set(as('admin-a'))
      .send({ isPrimary: false })
      .expect(200);
    await http()
      .patch(`/api/v1/admin/parents/${uncleId}/children/${f.ids.studentA}`)
      .set(as('admin-a'))
      .send({ isPrimary: true })
      .expect(200);
    expect(
      await f.prisma.studentParent.count({
        where: { studentId: f.ids.studentA, primarySlot: { not: null } },
      }),
    ).toBe(2);

    // School B cannot link its parent to a school A student.
    await http()
      .post(`/api/v1/admin/parents/${f.ids.parentB}/children`)
      .set(as('admin-b'))
      .send({ studentId: f.ids.studentA, relationshipType: 'GUARDIAN' })
      .expect(403);

    await http()
      .delete(`/api/v1/admin/parents/${uncleId}/children/${f.ids.studentA}`)
      .set(as('admin-a'))
      .expect(200);
    // studentANoTeacher's only guardian cannot be removed.
    await http()
      .delete(
        `/api/v1/admin/parents/${f.ids.parentA}/children/${f.ids.studentANoTeacher}`,
      )
      .set(as('admin-a'))
      .expect(400);
  });

  it('another school finds an existing parent by exact login or CNIC and learns nothing else', async () => {
    const res = await http()
      .post('/api/v1/admin/parents/lookup')
      .set(as('admin-b'))
      .send({ identifier: 'bl23g-parent-a' })
      .expect(201);
    expect(Object.keys(res.body as object).sort()).toEqual([
      'id',
      'identifier',
      'name',
    ]);
    expect(res.body.id).toBe(f.ids.parentA);
    await http()
      .post('/api/v1/admin/parents/lookup')
      .set(as('admin-b'))
      .send({ identifier: 'bl23g-nobody' })
      .expect(404);
    await http()
      .post('/api/v1/admin/parents/lookup')
      .set(as('admin-b'))
      .send({ identifier: 'bl23g-parent-a', cnic: '35202-0000000-0' })
      .expect(400);
    expect(
      await f.prisma.auditLog.count({
        where: { action: 'parent.lookup', entityId: f.ids.parentA },
      }),
    ).toBeGreaterThan(0);
  });

  it('only a super admin gets the duplicate report, and it merges nothing', async () => {
    await http()
      .get('/api/v1/admin/parents/duplicates')
      .set(as('admin-a'))
      .expect(403);
    const before = await f.prisma.parentProfile.count();
    const res = await http()
      .get('/api/v1/admin/parents/duplicates')
      .set(as('super'))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(await f.prisma.parentProfile.count()).toBe(before);
  });

  it("a parent's message to the admin reaches the child's school", async () => {
    await http()
      .post('/api/v1/conversations')
      .set(as('parent-shared'))
      .send({ recipientType: 'SCHOOL_ADMIN', body: 'Which school?' })
      .expect(400);
    const toB = await http()
      .post('/api/v1/conversations')
      .set(as('parent-shared'))
      .send({
        recipientType: 'SCHOOL_ADMIN',
        studentId: f.ids.studentB,
        body: 'About B',
      })
      .expect(201);
    const toA = await http()
      .post('/api/v1/conversations')
      .set(as('parent-a'))
      .send({ recipientType: 'SCHOOL_ADMIN', body: 'About A' })
      .expect(201);
    const staffOf = async (id: string) =>
      (
        await f.prisma.conversation.findUniqueOrThrow({
          where: { id },
          select: { staffUser: { select: { identifier: true } } },
        })
      ).staffUser.identifier;
    expect(await staffOf((toB.body as { id: string }).id)).toBe(
      'bl23g-admin-b',
    );
    expect(await staffOf((toA.body as { id: string }).id)).toBe(
      'bl23g-admin-a',
    );
  });

  it("a school-wide circular reaches only that school's parents (shared parent included)", async () => {
    const res = await http()
      .post('/api/v1/circulars')
      .set(as('admin-b'))
      .send({
        title: 'BL23G notice',
        description: 'School B only',
        scope: 'school',
      })
      .expect(201);
    const recipients = await f.prisma.circularRecipient.findMany({
      where: { circularId: res.body.id },
      select: { user: { select: { identifier: true } } },
    });
    const ids = recipients.map((r) => r.user.identifier).sort();
    expect(ids).toEqual(['bl23g-parent-b', 'bl23g-parent-shared']);
  });

  it('the parent app lists every child with its school', async () => {
    const res = await http()
      .get('/api/v1/me/children')
      .set(as('parent-shared'))
      .expect(200);
    const schools = (res.body as { school: string }[])
      .map((c) => c.school)
      .sort();
    expect(schools).toEqual(['BL23G School A', 'BL23G School B']);
  });
});
