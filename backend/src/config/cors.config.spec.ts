import { parseCorsOrigins } from './cors.config';

describe('parseCorsOrigins', () => {
  it('defaults to the staff-console dev origin when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:5173']);
  });

  it('defaults to the staff-console dev origin when set to an empty string', () => {
    expect(parseCorsOrigins('')).toEqual(['http://localhost:5173']);
  });

  it('splits a comma-separated list and trims whitespace', () => {
    expect(parseCorsOrigins('https://staff.example.com, https://staff2.example.com')).toEqual([
      'https://staff.example.com',
      'https://staff2.example.com',
    ]);
  });

  it('drops empty entries from a trailing comma', () => {
    expect(parseCorsOrigins('https://staff.example.com,')).toEqual(['https://staff.example.com']);
  });
});