// backend/src/bulk-import/csv.spec.ts
import { BadRequestException } from '@nestjs/common';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a CSV buffer into rows with 1-based line numbers matching the file, header excluded', () => {
    const buffer = Buffer.from('grNumber,name\nGR-1,Alice\nGR-2,Bob\n');
    const rows = parseCsv(buffer, 2000);
    expect(rows).toEqual([
      { line: 2, row: { grNumber: 'GR-1', name: 'Alice' } },
      { line: 3, row: { grNumber: 'GR-2', name: 'Bob' } },
    ]);
  });

  it('rejects a file whose row count exceeds the cap', () => {
    const rows = Array.from({ length: 5 }, (_, i) => `GR-${i}`).join('\n');
    const buffer = Buffer.from(`grNumber\n${rows}\n`);
    expect(() => parseCsv(buffer, 3)).toThrow(BadRequestException);
  });
});
