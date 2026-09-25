import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SENSITIVE_FIELDS, withoutSensitive } from './sensitive-fields';

describe('sensitive fields (BL-07)', () => {
  it('strips national identifiers and health data', () => {
    expect(
      withoutSensitive('ParentProfile', {
        id: 'p',
        name: 'A',
        cnic: '42101-1',
      }),
    ).toEqual({ id: 'p', name: 'A' });
    expect(
      withoutSensitive('StudentMedicalInfo', {
        studentId: 's',
        allergies: 'nuts',
        bloodGroup: 'O_POS',
      }),
    ).toEqual({ studentId: 's' });
  });

  it('every listed column exists on its model in schema.prisma (the list cannot drift silently)', () => {
    const schema = readFileSync(
      join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
      'utf8',
    );
    for (const [model, fields] of Object.entries(SENSITIVE_FIELDS)) {
      const body = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(
        schema,
      )?.[1];
      expect(body).toBeDefined();
      for (const f of fields) {
        expect(body).toMatch(new RegExp(`\\n\\s+${f}\\s`));
      }
    }
  });
});
