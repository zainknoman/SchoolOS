import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/**
 * Bulk import never writes into another school: every section/campus id in the file must be inside
 * the importer's own school (campus, for a campus-scoped admin). Found while doing BL-23.
 */
describe('Bulk import stays inside the importer’s school (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const post = (path: string, who: string, csv: string) =>
    request(f.app.getHttpServer())
      .post(`/api/v1/bulk-import/${path}`)
      .set('Authorization', `Bearer ${tokens[who]}`)
      .attach('file', Buffer.from(csv), 'import.csv');

  beforeAll(async () => {
    f = await createTwoSchools('bis');
    for (const who of ['super', 'admin-a']) tokens[who] = await f.login(who);
  });
  afterAll(async () => {
    await f.close();
  });

  const studentsCsv = (sectionId: string) =>
    `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone,relationshipType\nBIS-X1,Scope Kid,${sectionId},bis-parent-a,,,,FATHER\n`;

  it("rejects a student row that names another school's section, accepts its own", async () => {
    const other = await post(
      'students/preview',
      'admin-a',
      studentsCsv(f.ids.sectionB),
    ).expect(201);
    expect(other.body.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('belongs to another school'),
      ]),
    );
    const own = await post(
      'students/preview',
      'admin-a',
      studentsCsv(f.ids.sectionA),
    ).expect(201);
    expect(own.body.rows[0].errors).toEqual([]);
    await post(
      'students/commit',
      'admin-a',
      studentsCsv(f.ids.sectionB),
    ).expect(400);
    expect(
      await f.prisma.student.count({ where: { grNumber: 'BIS-X1' } }),
    ).toBe(0);
  });

  it("rejects teacher and staff rows for another school's campus", async () => {
    const teachers = await post(
      'teachers/preview',
      'admin-a',
      `identifier,name,campusId\nbis-t-x,Scope Teacher,${f.ids.campusB}\n`,
    ).expect(201);
    expect(teachers.body.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('belongs to another school'),
      ]),
    );
    const staff = await post(
      'staff/preview',
      'admin-a',
      `name,employeeType,campusId,dateOfBirth,cnic,mobile,email,joiningDate,loginIdentifier\nScope Guard,GUARD,${f.ids.campusB},1990-01-01,,,,2024-01-01,\n`,
    ).expect(201);
    expect(staff.body.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('belongs to another school'),
      ]),
    );
  });

  it('a super admin may import into any school', async () => {
    const res = await post(
      'students/preview',
      'super',
      studentsCsv(f.ids.sectionB),
    ).expect(201);
    expect(res.body.rows[0].errors).toEqual([]);
  });
});
