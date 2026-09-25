import { defineStore } from 'pinia';
import { api, type LoginResponse } from '../lib/api';

const STORAGE_KEY = 'schoolos.auth';

// Teacher and Admin/Accounts share this one console, gated by role — not two deployable apps.
export type StaffRole = 'TEACHER' | 'SCHOOL_ADMIN' | 'ACCOUNTS' | 'SUPER_ADMIN';

interface PersistedSession {
  accessToken: string;
  refreshToken: string;
  role: string;
  isPrincipal: boolean;
  mustChangePassword: boolean;
  campusId: string | null;
  schoolId: string | null;
  grants?: string[];
}

function loadPersistedSession(): PersistedSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

// Single-flight guard for concurrent 401s: several in-flight requests can all expire around the
// same moment, and the backend rotates the refresh token on every redemption — a second
// concurrent refresh call would present an already-revoked token and fail. Kept as module-scope
// state (not Pinia state) since it holds a Promise, not serializable session data.
let inFlightRefresh: Promise<string | null> | null = null;

export const useAuthStore = defineStore('auth', {
  state: () => {
    const persisted = loadPersistedSession();
    return {
      accessToken: persisted?.accessToken ?? null,
      refreshToken: persisted?.refreshToken ?? null,
      role: persisted?.role ?? null,
      isPrincipal: persisted?.isPrincipal ?? false,
      mustChangePassword: persisted?.mustChangePassword ?? false,
      campusId: persisted?.campusId ?? null,
      schoolId: persisted?.schoolId ?? null,
      grants: persisted?.grants ?? [],
    } as {
      accessToken: string | null;
      refreshToken: string | null;
      role: string | null;
      isPrincipal: boolean;
      mustChangePassword: boolean;
      campusId: string | null;
      schoolId: string | null;
      grants: string[];
    };
  },

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
      this.refreshToken = session.refreshToken;
      this.role = session.role;
      this.isPrincipal = session.isPrincipal;
      this.mustChangePassword = session.mustChangePassword ?? false;
      this.campusId = session.campusId ?? null;
      this.schoolId = session.schoolId ?? null;
      this.grants = session.grants ?? [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    },

    // Called by the fetch interceptor (Task 5) on a 401. Returns the new access token on
    // success, or null after logging out on failure.
    refreshSession(): Promise<string | null> {
      if (!this.refreshToken) return Promise.resolve(null);
      if (!inFlightRefresh) {
        inFlightRefresh = this._doRefresh().finally(() => {
          inFlightRefresh = null;
        });
      }
      return inFlightRefresh;
    },

    async _doRefresh(): Promise<string | null> {
      try {
        const session = await api.refresh(this.refreshToken as string);
        this.applySession(session);
        return session.accessToken;
      } catch {
        this.logout();
        return null;
      }
    },

    // The server answered 403 PASSWORD_CHANGE_REQUIRED (BL-21): the flag was set after this session
    // started (e.g. an admin reset). Persist it so the router guard sends the user to change it.
    markPasswordChangeRequired() {
      this.mustChangePassword = true;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...JSON.parse(raw), mustChangePassword: true }));
        }
      } catch {
        // storage unavailable — the in-memory flag still drives this tab
      }
    },

    logout() {
      // Revoke the refresh token server-side (BL-21) — best effort: signing out locally must
      // never wait on, or fail because of, the network.
      const refreshToken = this.refreshToken;
      if (refreshToken) {
        void Promise.resolve()
          .then(() => api.logout(refreshToken))
          .catch(() => undefined);
      }
      this.accessToken = null;
      this.refreshToken = null;
      this.role = null;
      this.isPrincipal = false;
      this.mustChangePassword = false;
      this.campusId = null;
      this.schoolId = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});
