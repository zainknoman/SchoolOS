const THEME_STORAGE_KEY = 'seeds.theme';

export type ThemePreference = 'light' | 'dark' | null;

export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

export function saveThemePreference(mode: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Best-effort persistence only — the theme still applies for this session.
  }
}

export function applyTheme(mode: ThemePreference): void {
  if (mode) {
    document.documentElement.setAttribute('data-theme', mode);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
