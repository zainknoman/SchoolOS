import { defineStore } from 'pinia';
import { api } from '../lib/api';

const STORAGE_KEY = 'seeds.auth';

// Teacher and Admin/Accounts share this one console, gated by role — not two deployable apps.
export type StaffRole = 'TEACHER' | 'SCHOOL_ADMIN' | 'ACCOUNTS' | 'SUPER_ADMIN';

interface PersistedSession {
  accessToken: string;
  refreshToken: string;
  role: string;
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
    } as { accessToken: string | null; refreshToken: string | null; role: string | null };
  },

  getters: {
    isAuthenticated: (state) => state.accessToken !== null,
  },

  actions: {
    async login(identifier: string, password: string) {
      // Errors intentionally propagate to the caller (LoginView) unmodified — the API already
      // returns the correct generic message, this store must not add or remove information.
      const session = await api.login(identifier, password);
      this.accessToken = session.accessToken;
      this.refreshToken = session.refreshToken;
      this.role = session.role;
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
        this.accessToken = session.accessToken;
        this.refreshToken = session.refreshToken;
        this.role = session.role;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        return session.accessToken;
      } catch {
        this.logout();
        return null;
      }
    },

    logout() {
      this.accessToken = null;
      this.refreshToken = null;
      this.role = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});
