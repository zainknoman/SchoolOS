import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-30 (Q10, RD-9): parent complaints — a parent submits (category, title, description,
 * attachments); staff of the student's school assign an owner, add internal notes, respond,
 * resolve; every change is audited; parents never see internal notes.
 */
describe('Complaints workflow (e2e, BL-30)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let complaintId: string;
  let adminAUserId: string;
  let teacherAUserId: string;
  let adminBUserId: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl30');
    const users = await f.prisma.user.findMany({
      where: { identifier: { startsWith: 'bl30-' } },
    });
    const id = (x: string) =>
      users.find((u) => u.identifier === `bl30-${x}`)!.id;
    adminAUserId = id('admin-a');
    teacherAUserId = id('teacher-a');
    adminBUserId = id('admin-b');
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'teacher-a',
      'parent-a',
      'parent-b',
      'parent-shared',
    ]) {
      tokens[who] = await f.login(who);
    }
  });

  afterAll(async () => {
    try {
      const complaints = { student: { grNumber: { startsWith: 'BL30-' } } };
      const attachments = await f.prisma.complaintAttachment.findMany({
        where: { complaint: complaints },
        select: { fileId: true },
      });
      await f.prisma.complaint.deleteMany({ where: complaints });
      await f.prisma.file.deleteMany({
        where: { id: { in: attachments.map((a) => a.fileId) } },
      });
      const users = await f.prisma.user.findMany({
        where: { identifier: { startsWith: 'bl30-' } },
        select: { id: true },
      });
      await f.prisma.notification.deleteMany({
        where: { userId: { in: users.map((u) => u.id) } },
      });
    } finally {
      await f.close();
    }
  });

  it('a parent submits a complaint about their own child only', async () => {
    const res = await http()
      .post('/api/v1/complaints')
      .set(as('parent-a'))
      .send({
        studentId: f.ids.studentA,
        category: 'TRANSPORT',
        subject: 'Van late every day',
        description: 'The van has been 30 minutes late all week.',
      })
      .expect(201);
    complaintId = res.body.id;
    expect(res.body).toMatchObject({
      category: 'TRANSPORT',
      subject: 'Van late every day',
      status: 'open',
      raisedByMe: true,
    });
    expect(res.body).not.toHaveProperty('notes');
    expect(res.body).not.toHaveProperty('assignedTo');

    await http()
      .post('/api/v1/complaints')
      .set(as('parent-a'))
      .send({ studentId: f.ids.studentB, subject: 'x', description: 'y' })
      .expect(403);
    await http()
      .post('/api/v1/complaints')
      .set(as('parent-a'))
      .send({
        studentId: f.ids.studentA,
        category: 'NOPE',
        subject: 'x',
        description: 'y',
      })
      .expect(400);
  });

  it('a parent attaches a file; another school cannot', async () => {
    const res = await http()
      .post(`/api/v1/complaints/${complaintId}/attachments`)
      .set(as('parent-a'))
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), 'photo.pdf')
      .expect(201);
    expect(res.body.attachments).toEqual([
      expect.objectContaining({ originalName: 'photo.pdf' }),
    ]);
    const fileId = res.body.attachments[0].fileId;
    await http().get(`/api/v1/files/${fileId}`).set(as('parent-a')).expect(200);
    await http().get(`/api/v1/files/${fileId}`).set(as('admin-a')).expect(200);
    // KG-30: staff of another school cannot download it.
    await http().get(`/api/v1/files/${fileId}`).set(as('admin-b')).expect(403);
    await http().get(`/api/v1/files/${fileId}`).set(as('parent-b')).expect(403);
    await http()
      .post(`/api/v1/complaints/${complaintId}/attachments`)
      .set(as('admin-b'))
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), 'x.pdf')
      .expect(403);
  });

  it("appears in its school's queue only", async () => {
    const a = await http()
      .get('/api/v1/complaints/queue')
      .set(as('admin-a'))
      .expect(200);
    expect(a.body.map((c: { id: string }) => c.id)).toContain(complaintId);
    const b = await http()
      .get('/api/v1/complaints/queue')
      .set(as('admin-b'))
      .expect(200);
    expect(b.body.map((c: { id: string }) => c.id)).not.toContain(complaintId);
    const filtered = await http()
      .get('/api/v1/complaints/queue?status=resolved')
      .set(as('admin-a'))
      .expect(200);
    expect(filtered.body.map((c: { id: string }) => c.id)).not.toContain(
      complaintId,
    );
  });

  it('staff of another school cannot read, update or annotate it (KG-29)', async () => {
    await http()
      .get(`/api/v1/complaints/${complaintId}`)
      .set(as('admin-b'))
      .expect(403);
    await http()
      .patch(`/api/v1/complaints/${complaintId}`)
      .set(as('admin-b'))
      .send({ status: 'resolved', resolution: 'x' })
      .expect(403);
    await http()
      .post(`/api/v1/complaints/${complaintId}/notes`)
      .set(as('admin-b'))
      .send({ body: 'x', internal: true })
      .expect(403);
  });

  it('an admin assigns an owner of the same school only (audited, owner notified)', async () => {
    await http()
      .patch(`/api/v1/complaints/${complaintId}`)
      .set(as('admin-a'))
      .send({ assignedToId: adminBUserId })
      .expect(400);
    const res = await http()
      .patch(`/api/v1/complaints/${complaintId}`)
      .set(as('admin-a'))
      .send({ assignedToId: teacherAUserId, status: 'in_progress' })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'in_progress',
      assignedTo: expect.objectContaining({ id: teacherAUserId }),
    });
    expect(
      await f.prisma.auditLog.count({
        where: { action: 'complaint.update', entityId: complaintId },
      }),
    ).toBe(1);
    expect(
      await f.prisma.notification.count({
        where: { userId: teacherAUserId, entityRef: complaintId },
      }),
    ).toBe(1);
    const mine = await http()
      .get('/api/v1/complaints/queue?assigned=me')
      .set(as('teacher-a'))
      .expect(200);
    expect(mine.body.map((c: { id: string }) => c.id)).toEqual([complaintId]);
  });

  it('internal notes are hidden from parents; responses are shown', async () => {
    await http()
      .post(`/api/v1/complaints/${complaintId}/notes`)
      .set(as('teacher-a'))
      .send({ body: 'Driver warned; check the route timing.', internal: true })
      .expect(201);
    await http()
      .post(`/api/v1/complaints/${complaintId}/notes`)
      .set(as('admin-a'))
      .send({
        body: 'We have spoken to the transport contractor.',
        internal: false,
      })
      .expect(201);
    // A parent's comment is always visible to the school, never internal.
    await http()
      .post(`/api/v1/complaints/${complaintId}/notes`)
      .set(as('parent-a'))
      .send({ body: 'Thank you.', internal: true })
      .expect(201);

    const staff = await http()
      .get(`/api/v1/complaints/${complaintId}`)
      .set(as('admin-a'))
      .expect(200);
    expect(staff.body.notes).toHaveLength(3);
    expect(
      staff.body.notes.filter((n: { internal: boolean }) => n.internal),
    ).toHaveLength(1);

    const parent = await http()
      .get(`/api/v1/complaints/${complaintId}`)
      .set(as('parent-a'))
      .expect(200);
    const text = JSON.stringify(parent.body);
    expect(text).not.toContain('Driver warned');
    expect(parent.body).not.toHaveProperty('notes');
    expect(parent.body.responses.map((r: { body: string }) => r.body)).toEqual([
      'We have spoken to the transport contractor.',
      'Thank you.',
    ]);
    const list = await http()
      .get(`/api/v1/complaints?studentId=${f.ids.studentA}`)
      .set(as('parent-a'))
      .expect(200);
    expect(JSON.stringify(list.body)).not.toContain('Driver warned');
  });

  it('another guardian of the same child does not see this complaint', async () => {
    const list = await http()
      .get(`/api/v1/complaints?studentId=${f.ids.studentA}`)
      .set(as('parent-shared'))
      .expect(200);
    expect(list.body.map((c: { id: string }) => c.id)).not.toContain(
      complaintId,
    );
    await http()
      .get(`/api/v1/complaints/${complaintId}`)
      .set(as('parent-shared'))
      .expect(403);
  });

  it('resolving needs a resolution; the parent sees it and is notified', async () => {
    await http()
      .patch(`/api/v1/complaints/${complaintId}`)
      .set(as('admin-a'))
      .send({ status: 'resolved' })
      .expect(400);
    const res = await http()
      .patch(`/api/v1/complaints/${complaintId}`)
      .set(as('admin-a'))
      .send({ status: 'resolved', resolution: 'New driver from Monday.' })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'resolved',
      resolution: 'New driver from Monday.',
      resolvedBy: expect.objectContaining({ id: adminAUserId }),
    });
    const parent = await http()
      .get(`/api/v1/complaints/${complaintId}`)
      .set(as('parent-a'))
      .expect(200);
    expect(parent.body).toMatchObject({
      status: 'resolved',
      resolution: 'New driver from Monday.',
    });
    const parentUser = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl30-parent-a' },
    });
    expect(
      await f.prisma.notification.count({
        where: { userId: parentUser.id, entityRef: complaintId },
      }),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await f.prisma.auditLog.count({
        where: { entity: 'Complaint', entityId: complaintId },
      }),
    ).toBeGreaterThanOrEqual(6); // create, attach, 2 updates... notes x3
  });

  it('a parent cannot change status or assignment', async () => {
    await http()
      .patch(`/api/v1/complaints/${complaintId}`)
      .set(as('parent-a'))
      .send({ status: 'open' })
      .expect(403);
  });
});
