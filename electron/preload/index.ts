import { contextBridge, ipcRenderer, shell } from "electron";
import { cleanerBridge } from "./cleanerBridge";
import { memoryBridge } from "./memoryBridge";
import { entitlementsBridge } from "./entitlementsBridge";
import { updaterBridge } from "./updaterBridge";
import { maintenanceBridge } from "./maintenanceBridge";
import { overlayBridge } from "./overlayBridge";
import { aiBridge } from "./aiBridge";
import systemCheckBridge from "./systemCheckBridge";
import permissionsBridge from "./permissionsBridge";
import { exclusionsBridge } from "./exclusionsBridge";

export type ElectronAPI = typeof api;

const api = {
  // ── Window Controls ─────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },

  // Renderer readiness handshake prevents the native window from appearing before SplashScreen mounts.
  splash: {
    ready: () => ipcRenderer.send("splash:ready"),
  },

  // ── System ──────────────────────────────────────────────
  system: {
    getStats: (): Promise<import("../native/system").SystemStats> =>
      ipcRenderer.invoke("system:get-stats"),
    getHWID: (): Promise<string> => ipcRenderer.invoke("system:get-hwid"),
    getFingerprint: (): Promise<string> =>
      ipcRenderer.invoke("system:get-fingerprint"),
    getVersion: (): Promise<string> => ipcRenderer.invoke("system:get-version"),
  },

  // ── Shell ──────────────────────────────────────────────────
  // Only https:// and http:// are permitted.
  // All other protocols (file://, cmd://, javascript:, custom schemes)
  // are rejected silently to prevent local execution attacks.
  shell: {
    openExternal: (url: string) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          console.warn("[shell] Blocked unsafe protocol:", parsed.protocol);
          return;
        }
        shell.openExternal(url);
      } catch {
        console.warn("[shell] Blocked invalid URL:", url);
      }
    },
  },

  // ── Telemetry opt-out ────────────────────────────────────
  telemetry: {
    setEnabled: (enabled: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("telemetry:set-enabled", enabled),
  },

  // ── Auth ─────────────────────────────────────────────────
  auth: {
    onCallback: (callback: (url: string) => void) => {
      // Remove any existing listeners first to prevent duplicates on unmount/remount
      ipcRenderer.removeAllListeners("auth:callback");
      ipcRenderer.on("auth:callback", (_, url) => callback(url));
    },
    exchangeAuthCode: (code: string) =>
      ipcRenderer.invoke("propel:auth:exchange", code),
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
contextBridge.exposeInMainWorld("propel", {
  cleaner: cleanerBridge,
  memory: memoryBridge,
  entitlements: entitlementsBridge,
  updater: updaterBridge,
  maintenance: maintenanceBridge,
  overlay: overlayBridge,
  ai: aiBridge,
  systemCheck: systemCheckBridge,
  permissions: permissionsBridge,
  exclusions: exclusionsBridge,
});

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
