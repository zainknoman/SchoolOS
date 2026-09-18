import { describe, it, expect, vi, afterEach } from 'vitest';
import { applyTheme, loadThemePreference, saveThemePreference } from './theme';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  localStorage.removeItem('schoolos.theme');
  vi.restoreAllMocks();
});

describe('loadThemePreference', () => {
  it('returns a valid stored value', () => {
    localStorage.setItem('schoolos.theme', 'dark');
    expect(loadThemePreference()).toBe('dark');
  });

  it('returns null when nothing is stored', () => {
    expect(loadThemePreference()).toBeNull();
  });

  it('returns null for an invalid stored value', () => {
    localStorage.setItem('schoolos.theme', 'not-a-theme');
    expect(loadThemePreference()).toBeNull();
  });

  it('returns null and does not throw if localStorage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => loadThemePreference()).not.toThrow();
    expect(loadThemePreference()).toBeNull();
  });
});

describe('applyTheme', () => {
  it('sets data-theme to the given mode', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes the attribute when given null', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    applyTheme(null);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('saveThemePreference', () => {
  it('writes to localStorage', () => {
    saveThemePreference('dark');
    expect(localStorage.getItem('schoolos.theme')).toBe('dark');
  });

  it('does not throw if localStorage access throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => saveThemePreference('light')).not.toThrow();
  });
});
