/**
 * Auth lifecycle rules (renderer). Pure and dependency-injected so it can be
 * unit-tested in Node (tests/test_logout_persistence.cjs).
 *
 * RULE: the app is "logged in" ONLY when a valid session exists. A cached
 * entitlement / saved plan is never proof of login. Without a session the
 * app starts on Login, also when offline and also when a cached plan exists.
 */

export interface StorageLike {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Supabase persists its session under `sb-<project>-auth-token`. */
const SUPABASE_SESSION_KEY = /^sb-[a-z0-9-]+-auth-token(-code-verifier)?$/i
export const PENDING_DEVICE_RELEASE_KEY = "propel.pendingDeviceRelease";

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  user?: { email?: string } & Record<string, unknown>;
  [k: string]: unknown;
}

function storageKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

/** The persisted Supabase session, if any (works offline, no network). */
export function readStoredSession(storage: StorageLike): StoredSession | null {
  try {
    for (const key of storageKeys(storage)) {
      if (!SUPABASE_SESSION_KEY.test(key) || key.endsWith("-code-verifier")) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const s = parsed?.currentSession ?? parsed; // supabase-js v1 / v2 shapes
      if (s && typeof s.refresh_token === "string" && s.refresh_token && typeof s.access_token === "string") {
        return s as StoredSession;
      }
    }
  } catch {
    /* unreadable storage = no session */
  }
  return null;
}

/** Removes every persisted Supabase session key. Idempotent. */
export function removeStoredSessionKeys(storage: StorageLike): string[] {
  const removed: string[] = [];
  for (const key of storageKeys(storage)) {
    if (SUPABASE_SESSION_KEY.test(key)) {
      storage.removeItem(key);
      removed.push(key);
    }
  }
  return removed;
}

// ── Startup decision ─────────────────────────────────────────────────────
export interface CachedPlan {
  plan?: string;
  isFallback?: boolean;
}

export interface StartupInput {
  /** Session returned by supabase.auth.getSession() (null if none/failed). */
  session: unknown | null;
  /** Session persisted in storage (survives offline token expiry). */
  storedSession: StoredSession | null;
  online: boolean;
  /** getSession failed for network reasons (not "signed out"). */
  sessionErrorIsNetwork: boolean;
  cached: CachedPlan | null;
}

export type StartupDecision =
  | { kind: "login" }
  | { kind: "main-online" }
  | { kind: "main-offline"; useCachedPlan: boolean; restoredFromStorage: boolean };

export function decideStartup(input: StartupInput): StartupDecision {
  const cachedValid = !!input.cached && !input.cached.isFallback;

  if (input.session) {
    return input.online
      ? { kind: "main-online" }
      : { kind: "main-offline", useCachedPlan: cachedValid, restoredFromStorage: false };
  }

  // No live session. Only a persisted session that could not be refreshed
  // because we are OFFLINE keeps the user logged in (offline grace).
  const offline = !input.online || input.sessionErrorIsNetwork;
  if (input.storedSession && offline) {
    return { kind: "main-offline", useCachedPlan: cachedValid, restoredFromStorage: true };
  }

  // Signed out, revoked, or never logged in: a cached plan is ignored.
  return { kind: "login" };
}

// ── Logout ───────────────────────────────────────────────────────────────
export interface LogoutDeps {
  getAccessToken(): string | null;
  getDeviceId(): Promise<string | null>;
  /** Backend call that frees the device slot. true = released (or already gone). */
  releaseDevice(deviceId: string, token: string): Promise<boolean>;
  queueDeviceRelease(deviceId: string): void;
  /** supabase.auth.signOut({ scope: "local" }) */
  signOutLocal(): Promise<void>;
  /** Belt and braces: delete persisted session keys even if signOut failed. */
  removeStoredSessions(): void;
  /** Main process: cached entitlement, license file, device registration. */
  clearMainAuthFiles(): Promise<{ ok: boolean }>;
  /** In-memory stores (session, plan, page caches). */
  resetMemory(): void;
  /** Best-effort follow-ups (e.g. remove the PRO scheduler task). */
  afterClear?(): Promise<void>;
  goToLogin(): void;
}

export interface LogoutOptions {
  reason?: "user" | "session-ended" | "device-removed";
  /** Notify the backend to free the device slot (default true). */
  releaseDevice?: boolean;
}

export interface LogoutResult {
  released: boolean;
  queued: boolean;
  filesCleared: boolean;
}

/**
 * Builds the single logout function. Idempotent: concurrent calls share one
 * run. Local logout ALWAYS completes, even if the backend or any step fails,
 * and the Login screen is shown only after the local clear has finished.
 */
export function createLogout(deps: LogoutDeps): (opts?: LogoutOptions) => Promise<LogoutResult> {
  let inFlight: Promise<LogoutResult> | null = null;

  const run = async (opts: LogoutOptions): Promise<LogoutResult> => {
    let released = false;
    let queued = false;
    let filesCleared = false;
    try {
      const token = (() => {
        try {
          return deps.getAccessToken();
        } catch {
          return null;
        }
      })();
      let deviceId: string | null = null;
      try {
        deviceId = await deps.getDeviceId();
      } catch {
        deviceId = null;
      }

      if (opts.releaseDevice !== false && deviceId) {
        if (token) {
          try {
            released = await deps.releaseDevice(deviceId, token);
          } catch {
            released = false;
          }
        }
        if (!released) {
          try {
            deps.queueDeviceRelease(deviceId);
            queued = true;
          } catch {
            /* storage full: nothing else to do */
          }
        }
      }
    } finally {
      // Local logout always happens.
      try {
        await deps.signOutLocal();
      } catch {
        /* removeStoredSessions below still clears the tokens */
      }
      try {
        deps.removeStoredSessions();
      } catch {
        /* ignore */
      }
      try {
        filesCleared = (await deps.clearMainAuthFiles()).ok;
      } catch {
        filesCleared = false;
      }
      try {
        deps.resetMemory();
      } catch {
        /* ignore */
      }
      try {
        await deps.afterClear?.();
      } catch {
        /* best effort */
      }
      deps.goToLogin();
    }
    return { released, queued, filesCleared };
  };

  return (opts: LogoutOptions = {}) => {
    if (!inFlight) {
      inFlight = run(opts).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
