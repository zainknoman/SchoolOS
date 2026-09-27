import { defineStore } from 'pinia';
import { api, type LoginResponse } from '../lib/api';

// BL-36 option B (owner decision 2026-09-28): the refresh token is an HttpOnly Secure
// SameSite=Strict cookie that page script cannot read, and the access token lives only in this
// store's memory — so an XSS bug can no longer carry a session off the machine (KG-9). A reload
// gets a fresh access token from the cookie (restoreSession).
//
// The only thing kept in localStorage is a non-secret hint that this browser has a session, so a
// visitor who never signed in does not trigger a refresh call on every page load.
const SESSION_HINT_KEY = 'schoolos.hasSession';
// Pre-BL-36 consoles stored both tokens here; restoreSession moves such a session into the cookie
// once and deletes the key.
const LEGACY_STORAGE_KEY = 'schoolos.auth';
// Serialises refreshes across tabs: they share one cookie that rotates on every use, so two tabs
// refreshing at the same moment would otherwise present the same, already-rotated token.
const REFRESH_LOCK = 'schoolos.refresh';

// Teacher and Admin/Accounts share this one console, gated by role — not two deployable apps.
export type StaffRole = 'TEACHER' | 'SCHOOL_ADMIN' | 'ACCOUNTS' | 'SUPER_ADMIN';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeHint(on: boolean): void {
  try {
    if (on) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // storage unavailable — the only cost is one extra refresh call on the next load
  }
}

/** Takes (and deletes) a pre-BL-36 refresh token from localStorage, if one is there. */
function takeLegacyRefreshToken(): string | undefined {
  const raw = readStorage(LEGACY_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    const token = (JSON.parse(raw) as { refreshToken?: unknown }).refreshToken;
    return typeof token === 'string' && token ? token : undefined;
  } catch {
    return undefined;
  }
}

function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? (locks.request(REFRESH_LOCK, run) as Promise<T>) : run();
}

// Single-flight guard for concurrent 401s in this tab: several in-flight requests can all expire
// around the same moment. Kept as module-scope state (not Pinia state) since it holds a Promise.
let inFlightRefresh: Promise<string | null> | null = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null as string | null,
    role: null as string | null,
    isPrincipal: false,
    mustChangePassword: false,
    campusId: null as string | null,
    schoolId: null as string | null,
    grants: [] as string[],
  }),

  getters: {
    isAuthenticated: (state) => state.accessToken !== null,
    /** BL-32: ACCOUNTS reaches admissions/complaints/messages only with a grant; others always. */
    hasModule: (state) => (grant: string) => state.role !== 'ACCOUNTS' || state.grants.includes(grant),
  },

  actions: {
    async login(identifier: string, password: string) {
      // Errors intentionally propagate to the caller (LoginView) unmodified — the API already
      // returns the correct generic message, this store must not add or remove information.
      const session = await api.login(identifier, password);
      this.applySession(session);
    },

    applySession(session: LoginResponse) {
      this.accessToken = session.accessToken;
      this.role = session.role;
      this.isPrincipal = session.isPrincipal;
      this.mustChangePassword = session.mustChangePassword ?? false;
      this.campusId = session.campusId ?? null;
      this.schoolId = session.schoolId ?? null;
      this.grants = session.grants ?? [];
      writeHint(true);
    },

    /**
     * Called once at startup, before the router runs: gets an access token from the cookie
     * session (or, once, from a pre-BL-36 stored refresh token). Never throws.
     */
    async restoreSession(): Promise<void> {
      const legacy = takeLegacyRefreshToken();
      if (!legacy && readStorage(SESSION_HINT_KEY) === null) return;
      try {
        this.applySession(await withRefreshLock(() => api.refresh(legacy)));
      } catch {
        this.clearSession();
      }
    },

    // Called by the fetch interceptor on a 401. Returns the new access token on success, or null
    // after logging out on failure.
    refreshSession(): Promise<string | null> {
      if (!this.accessToken) return Promise.resolve(null);
      if (!inFlightRefresh) {
        inFlightRefresh = this._doRefresh().finally(() => {
          inFlightRefresh = null;
        });
      }
      return inFlightRefresh;
    },

    async _doRefresh(): Promise<string | null> {
      try {
        const session = await withRefreshLock(() => api.refresh());
        this.applySession(session);
        return session.accessToken;
      } catch {
        this.logout();
        return null;
      }
    },

    // The server answered 403 PASSWORD_CHANGE_REQUIRED (BL-21): the flag was set after this session
    // started (e.g. an admin reset). The router guard sends the user to change it.
    markPasswordChangeRequired() {
      this.mustChangePassword = true;
    },

    logout() {
      // Revoke the cookie session server-side (BL-21) — best effort: signing out locally must
      // never wait on, or fail because of, the network. The response also clears the cookie.
      if (this.accessToken) {
        void Promise.resolve()
          .then(() => api.logout())
          .catch(() => undefined);
      }
      this.clearSession();
    },

    clearSession() {
      this.accessToken = null;
      this.role = null;
      this.isPrincipal = false;
      this.mustChangePassword = false;
      this.campusId = null;
      this.schoolId = null;
      this.grants = [];
      writeHint(false);
    },
  },
});
