import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/** BL-52 (KG-14): uploads are typed by their bytes against an allow-list, end to end. */
describe('Upload hardening (e2e)', () => {
  let f: TwoSchools;
  let token: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl52');
    token = await f.login('admin-a');
  });
  afterAll(async () => {
    await f.close();
  });

  const upload = (buffer: Buffer, name: string, contentType?: string) =>
    request(f.app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${token}`)
      .attach(
        'file',
        buffer,
        contentType ? { filename: name, contentType } : name,
      );

  it('stores the server-detected type, ignoring the client-reported one', async () => {
    const res = await upload(
      Buffer.from('Read chapter 2'),
      'worksheet.txt',
      'text/html',
    ).expect(201);
    expect(res.body.mimeType).toBe('text/plain');
    const row = await f.prisma.file.findUniqueOrThrow({
      where: { id: res.body.id as string },
    });
    expect(row.mimeType).toBe('text/plain');
    await f.prisma.auditLog.deleteMany({ where: { entityId: row.id } });
    await f.prisma.file.delete({ where: { id: row.id } });
  });

  it('refuses HTML disguised as a PDF', async () => {
    const res = await upload(
      Buffer.from('<html><script>alert(1)</script></html>'),
      'report.pdf',
      'application/pdf',
    ).expect(400);
    expect(res.body.message).toMatch(/not allowed/);
  });

  it('refuses a real image whose extension lies', async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
    ]);
    const res = await upload(png, 'report.pdf').expect(400);
    expect(res.body.message).toMatch(/does not match/);
  });

  it('refuses an SVG and an empty file', async () => {
    await upload(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
      'logo.svg',
    ).expect(400);
    await upload(Buffer.alloc(0), 'empty.pdf').expect(400);
  });
});
