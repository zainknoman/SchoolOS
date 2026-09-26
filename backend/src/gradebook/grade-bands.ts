import { BadRequestException } from '@nestjs/common';

export interface Band {
  minPercent: number;
  letter: string;
  remark: string | null;
  gradePoint: number | null;
}

/**
 * BL-27: a valid scale has 1–20 bands, distinct minimums between 0 and 100, a band starting at 0
 * (so every percentage gets a letter) and non-empty letters. Returned highest band first.
 */
export function normaliseBands(
  bands: {
    minPercent: number;
    letter: string;
    remark?: string | null;
    gradePoint?: number | null;
  }[],
): Band[] {
  if (bands.length === 0 || bands.length > 20) {
    throw new BadRequestException('A grading scale needs 1 to 20 bands');
  }
  const out = bands.map((b) => ({
    minPercent: b.minPercent,
    letter: b.letter.trim(),
    remark: b.remark?.trim() || null,
    gradePoint: b.gradePoint ?? null,
  }));
  for (const b of out) {
    if (!(b.minPercent >= 0 && b.minPercent <= 100)) {
      throw new BadRequestException('Band minimums must be between 0 and 100');
    }
    if (!b.letter) throw new BadRequestException('Every band needs a letter');
  }
  if (new Set(out.map((b) => b.minPercent)).size !== out.length) {
    throw new BadRequestException('Two bands start at the same percentage');
  }
  if (!out.some((b) => b.minPercent === 0)) {
    throw new BadRequestException(
      'The lowest band must start at 0 % so every result gets a grade',
    );
  }
  return out.sort((a, b) => b.minPercent - a.minPercent);
}

/** The band a percentage falls in (bands sorted highest first; one starts at 0). */
export function bandFor(percent: number, bands: Band[]): Band | null {
  return bands.find((b) => percent >= b.minPercent) ?? null;
}

/** Weights of a class/term count as 100 % within a rounding tolerance. */
export function weightsTotal100(total: number): boolean {
  return Math.abs(total - 100) < 0.01;
}
