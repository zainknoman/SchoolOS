import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * BL-63 / BL-07 (RD-6, Q7): "no automatic deletion". Every scheduled entry point in the codebase
 * (Nest @Cron/@Interval/@Timeout, raw setInterval/setTimeout loops) must not delete records. If a
 * future job needs to, it must go through legal approval and change this test deliberately.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('no automatic deletion (BL-63)', () => {
  const root = join(__dirname, '..');
  const scheduled = sources(root).filter((p) =>
    /@(Cron|Interval|Timeout)\(|\bset(Interval|Timeout)\(/.test(
      readFileSync(p, 'utf8'),
    ),
  );

  it('finds the scheduled entry points (the scan works)', () => {
    expect(scheduled.map((p) => p.replace(/\\/g, '/'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('attendance-risk/attendance-risk.job.ts'),
        expect.stringContaining('notifications/digest-dispatch.job.ts'),
      ]),
    );
  });

  it('no scheduled entry point deletes records', () => {
    const offenders = scheduled.filter((p) =>
      /\.(delete|deleteMany)\(|DELETE\s+FROM|TRUNCATE/i.test(
        readFileSync(p, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('the retention module itself never deletes', () => {
    const retention = sources(join(root, 'retention'));
    expect(
      retention.filter((p) =>
        /\.(delete|deleteMany)\(/.test(readFileSync(p, 'utf8')),
      ),
    ).toEqual([]);
  });
});
