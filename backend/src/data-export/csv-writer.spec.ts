import { csvCell, toCsv } from './csv-writer';

const BOM = String.fromCharCode(0xfeff);

describe('csv writer (BL-41)', () => {
  it('leaves plain values alone and blanks null/undefined', () => {
    expect(csvCell('Ali Khan')).toBe('Ali Khan');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(new Date('2026-09-01T00:00:00Z'))).toBe(
      '2026-09-01T00:00:00.000Z',
    );
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Khan, Ali')).toBe('"Khan, Ali"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formulas (CSV injection)', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(
      `"'=HYPERLINK(""http://x"")"`,
    );
    expect(csvCell('+92 300 1234567')).toBe("'+92 300 1234567");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('writes a header row, CRLF lines and a UTF-8 BOM', () => {
    const csv = toCsv(
      [
        { header: 'name', value: (r: { n: string; a: number }) => r.n },
        { header: 'age', value: (r) => r.a },
      ],
      [
        { n: 'Sara', a: 9 },
        { n: 'Omar, Jr', a: 10 },
      ],
    );
    expect(csv).toBe(BOM + 'name,age\r\nSara,9\r\n"Omar, Jr",10\r\n');
  });

  it('an empty export still has its header', () => {
    expect(toCsv([{ header: 'id', value: () => 'x' }], [])).toBe(
      BOM + 'id\r\n',
    );
  });
});
