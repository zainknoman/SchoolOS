import { createI18n } from 'vue-i18n';
import en from '../locales/en.json';
import ur from '../locales/ur.json';

export const LOCALE_STORAGE_KEY = 'schoolportal.locale';
export type AppLocale = 'en' | 'ur';

export function loadLocalePreference(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === 'ur' ? 'ur' : 'en';
  } catch {
    return 'en';
  }
}

export function saveLocalePreference(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private browsing / storage disabled — the choice just won't survive a reload.
  }
}

// Coarse dir flip only, per this sprint's scope: browser-default bidi + flex behavior does most
// of the visual mirroring; a full CSS logical-properties refactor is a documented follow-up.
export function applyLocaleToDocument(locale: AppLocale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ur' ? 'rtl' : 'ltr';
}

export const i18n = createI18n({
  legacy: false,
  locale: loadLocalePreference(),
  fallbackLocale: 'en',
  messages: { en, ur },
});
