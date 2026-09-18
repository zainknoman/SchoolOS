import { describe, it, expect } from 'vitest';
import { formatPkrShort, formatPkrFull, initialsFromName, roleInitials, formatDateTime, formatTimeAgo } from './format';

describe('formatPkrShort', () => {
  it('formats millions with one decimal place', () => {
    expect(formatPkrShort(2_400_000)).toBe('2.4M');
  });

  it('formats thousands with no decimal place', () => {
    expect(formatPkrShort(680_000)).toBe('680K');
  });

  it('leaves small amounts as plain numbers', () => {
    expect(formatPkrShort(450)).toBe('450');
  });
});

describe('formatPkrFull', () => {
  it('adds thousands separators', () => {
    expect(formatPkrFull(18450)).toBe('18,450');
  });
});

describe('initialsFromName', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFromName('Ali Khan')).toBe('AK');
  });

  it('takes the first two letters of a single word', () => {
    expect(initialsFromName('Eshaal')).toBe('ES');
  });

  it('falls back to "?" for an empty name', () => {
    expect(initialsFromName('   ')).toBe('?');
  });
});

describe('roleInitials', () => {
  it('maps each known staff role to a two-letter code', () => {
    expect(roleInitials('TEACHER')).toBe('TR');
    expect(roleInitials('SCHOOL_ADMIN')).toBe('SA');
    expect(roleInitials('ACCOUNTS')).toBe('AC');
    expect(roleInitials('SUPER_ADMIN')).toBe('SU');
  });

  it('falls back to "?" for an unknown or null role', () => {
    expect(roleInitials(null)).toBe('?');
    expect(roleInitials('SOMETHING_ELSE')).toBe('?');
  });
});

describe('formatDateTime', () => {
  it('includes the day, month, and time', () => {
    // Timezone-independent assertions only — the exact hour shifts with the runner's locale.
    const result = formatDateTime('2026-08-29T12:00:00.000Z');
    expect(result).toContain('Aug');
    expect(result).toContain('29');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatTimeAgo', () => {
  it('returns "just now" for a timestamp less than a minute old', () => {
    expect(formatTimeAgo(new Date().toISOString())).toBe('just now');
  });

  it('returns minutes ago for a timestamp under an hour old', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago for a timestamp under a day old', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago for anything older than a day', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
  });
});
