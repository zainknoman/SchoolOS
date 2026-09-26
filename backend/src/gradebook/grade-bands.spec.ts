import { bandFor, normaliseBands, weightsTotal100 } from './grade-bands';

describe('grade bands (BL-27)', () => {
  const scale = normaliseBands([
    { minPercent: 0, letter: 'F', remark: 'Fail' },
    { minPercent: 80, letter: 'A', gradePoint: 4 },
    { minPercent: 60, letter: ' B ', remark: '  ' },
  ]);

  it('sorts highest first and trims', () => {
    expect(scale.map((b) => b.letter)).toEqual(['A', 'B', 'F']);
    expect(scale[1].remark).toBeNull();
    expect(scale[0].gradePoint).toBe(4);
    expect(scale[2].gradePoint).toBeNull();
  });

  it('maps a percentage to the band it falls in (boundaries inclusive)', () => {
    expect(bandFor(100, scale)?.letter).toBe('A');
    expect(bandFor(80, scale)?.letter).toBe('A');
    expect(bandFor(79.9, scale)?.letter).toBe('B');
    expect(bandFor(60, scale)?.letter).toBe('B');
    expect(bandFor(0, scale)?.letter).toBe('F');
  });

  it('rejects scales that leave a percentage without a grade or are ambiguous', () => {
    expect(() => normaliseBands([])).toThrow(/1 to 20/);
    expect(() => normaliseBands([{ minPercent: 50, letter: 'P' }])).toThrow(
      /start at 0/,
    );
    expect(() =>
      normaliseBands([
        { minPercent: 0, letter: 'F' },
        { minPercent: 0, letter: 'E' },
      ]),
    ).toThrow(/same percentage/);
    expect(() =>
      normaliseBands([
        { minPercent: 0, letter: 'F' },
        { minPercent: 101, letter: 'A' },
      ]),
    ).toThrow(/between 0 and 100/);
    expect(() => normaliseBands([{ minPercent: 0, letter: '  ' }])).toThrow(
      /letter/,
    );
  });

  it('weights must total 100 % (float-tolerant)', () => {
    expect(weightsTotal100(100)).toBe(true);
    expect(weightsTotal100(33.33 + 33.33 + 33.34)).toBe(true);
    expect(weightsTotal100(90)).toBe(false);
    expect(weightsTotal100(100.5)).toBe(false);
  });
});
