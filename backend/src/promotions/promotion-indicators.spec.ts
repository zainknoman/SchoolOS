import {
  DEFAULT_PROMOTION_POLICY,
  evaluateIndicators,
  type RawIndicators,
} from './promotion-indicators';

const raw = (over: Partial<RawIndicators> = {}): RawIndicators => ({
  attendance: { present: 90, late: 0, absent: 10, leave: 0 },
  results: { obtained: 80, max: 100, assessments: 4 },
  fees: { outstanding: 0, unpaidVouchers: 0 },
  ...over,
});

describe('evaluateIndicators (BL-05)', () => {
  it('a student meeting every threshold has no warnings and is not blocked', () => {
    const r = evaluateIndicators(raw(), DEFAULT_PROMOTION_POLICY);
    expect(r.attendance.percent).toBe(90);
    expect(r.results.percent).toBe(80);
    expect(r.warnings).toEqual([]);
    expect(r.blocked).toBe(false);
  });

  it('low attendance, low results and fees due are warnings only under the default policy', () => {
    const r = evaluateIndicators(
      raw({
        attendance: { present: 5, late: 1, absent: 4, leave: 3 },
        results: { obtained: 30, max: 100, assessments: 2 },
        fees: { outstanding: 150000, unpaidVouchers: 1 },
      }),
      DEFAULT_PROMOTION_POLICY,
    );
    expect(r.attendance.percent).toBe(60); // leave is excused: 6 / (6 + 4)
    expect(r.warnings.map((w) => w.code)).toEqual([
      'LOW_ATTENDANCE',
      'LOW_RESULTS',
      'FEES_OUTSTANDING',
    ]);
    expect(
      r.warnings.find((w) => w.code === 'FEES_OUTSTANDING')?.message,
    ).toContain('Rs 1500.00');
    expect(r.blocked).toBe(false);
  });

  it('a rule blocks only when the school turned its block flag on', () => {
    const r = evaluateIndicators(
      raw({ fees: { outstanding: 100, unpaidVouchers: 1 } }),
      { ...DEFAULT_PROMOTION_POLICY, blockOnFees: true, blockOnResults: true },
    );
    expect(r.warnings).toEqual([
      expect.objectContaining({ code: 'FEES_OUTSTANDING', blocking: true }),
    ]);
    expect(r.blocked).toBe(true);
  });

  it('missing data is reported but never blocks', () => {
    const r = evaluateIndicators(
      raw({
        attendance: { present: 0, late: 0, absent: 0, leave: 2 },
        results: { obtained: 0, max: 0, assessments: 0 },
      }),
      {
        ...DEFAULT_PROMOTION_POLICY,
        blockOnAttendance: true,
        blockOnResults: true,
      },
    );
    expect(r.attendance.percent).toBeNull();
    expect(r.results.percent).toBeNull();
    expect(r.warnings.map((w) => [w.code, w.blocking])).toEqual([
      ['NO_ATTENDANCE_DATA', false],
      ['NO_RESULTS_DATA', false],
    ]);
    expect(r.blocked).toBe(false);
  });

  it('a threshold is inclusive (exactly the minimum passes)', () => {
    const r = evaluateIndicators(
      raw({ attendance: { present: 75, late: 0, absent: 25, leave: 0 } }),
      DEFAULT_PROMOTION_POLICY,
    );
    expect(r.warnings).toEqual([]);
  });
});
