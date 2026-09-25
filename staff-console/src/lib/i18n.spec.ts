import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocalePreference, saveLocalePreference, LOCALE_STORAGE_KEY } from './i18n';

describe('locale preference (BL-34 key rename)', () => {
  beforeEach(() => localStorage.clear());

  it('saves under the SchoolOS key', () => {
    saveLocalePreference('ur');
    expect(LOCALE_STORAGE_KEY).toBe('schoolos.locale');
    expect(localStorage.getItem('schoolos.locale')).toBe('ur');
  });

  it('still honours a choice saved under the pre-rebrand key', () => {
    localStorage.setItem('schoolportal.locale', 'ur');
    expect(loadLocalePreference()).toBe('ur');
  });

  it('prefers the new key over the legacy one', () => {
    localStorage.setItem('schoolportal.locale', 'ur');
    localStorage.setItem('schoolos.locale', 'en');
    expect(loadLocalePreference()).toBe('en');
  });
});
