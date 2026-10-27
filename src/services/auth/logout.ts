/**
 * The app's ONE logout. Every sign-out path (Settings, device removed,
 * device-limit screen, session ended on the server) goes through here.
 * Rules live in ./authLifecycle (unit-tested); this file wires real deps.
 */
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  createLogout,
  readStoredSession,
  removeStoredSessionKeys,
  PENDING_DEVICE_RELEASE_KEY,
} from "./authLifecycle";

const RELEASE_TIMEOUT_MS = 5000;

function apiBase(): string {
  const rawBase = import.meta.env.VITE_API_BASE_URL || "https://cleanmasterpro-backend-server.onrender.com";
  return rawBase.endsWith("/api") ? rawBase : `${rawBase.replace(/\/$/, "")}/api`;
}

/** DELETE /devices/:id. true when released or already gone (404). */
async function releaseDeviceOnServer(deviceId: string, token: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELEASE_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return res.ok || res.status === 404;
  } catch {
    return false; // offline / timeout
  } finally {
    clearTimeout(timer);
  }
}

/** Wipes on-disk + persisted login state. Used by logout and by startup when no session exists. */
async function clearPersistedAuth(): Promise<{ ok: boolean }> {
  try {
    removeStoredSessionKeys(window.localStorage);
  } catch {
    /* ignore */
  }
  try {
    const res = await window.propel?.entitlements?.clearLocalSession?.();
    return { ok: !!res?.ok };
  } catch {
    return { ok: false };
  }
}

export const logout = createLogout({
  getAccessToken: () =>
    useAppStore.getState().session?.access_token ?? readStoredSession(window.localStorage)?.access_token ?? null,
  getDeviceId: async () => (await window.electronAPI.system.getDeviceUUID())?.device_id ?? null,
  releaseDevice: releaseDeviceOnServer,
  queueDeviceRelease: (deviceId) =>
    window.localStorage.setItem(
      PENDING_DEVICE_RELEASE_KEY,
      JSON.stringify({ device_id: deviceId, queued_at: new Date().toISOString() }),
    ),
  signOutLocal: async () => {
    await supabase.auth.signOut({ scope: "local" });
  },
  removeStoredSessions: () => removeStoredSessionKeys(window.localStorage),
  clearMainAuthFiles: async () => {
    const res = await window.propel?.entitlements?.clearLocalSession?.();
    return { ok: !!res?.ok };
  },
  resetMemory: () => {
    useAppStore.getState().resetUserSession();
    const initial = useSessionStore.getInitialState?.();
    if (initial) useSessionStore.setState(initial, true);
  },
  // Cached plan is gone, so this removes the PRO-only scheduled task.
  afterClear: async () => {
    await window.propel?.maintenance?.syncScheduler?.();
  },
  goToLogin: () => useAppStore.getState().setPhase("login"),
});

/** Startup without a valid session: remove stale cache/tokens, stay logged out. */
export function clearLocalAuthState(): Promise<{ ok: boolean }> {
  return clearPersistedAuth();
}

/**
 * Retries a device release queued by an offline logout. Needs a valid token,
 * so it runs after the next successful login (before the device ping).
 */
export async function flushPendingDeviceRelease(token: string): Promise<void> {
  let pending: { device_id?: string } | null = null;
  try {
    pending = JSON.parse(window.localStorage.getItem(PENDING_DEVICE_RELEASE_KEY) || "null");
  } catch {
    pending = null;
  }
  if (!pending?.device_id) return;
  if (await releaseDeviceOnServer(pending.device_id, token)) {
    window.localStorage.removeItem(PENDING_DEVICE_RELEASE_KEY);
  }
}
