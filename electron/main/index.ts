import { app, BrowserWindow, ipcMain, shell, nativeTheme, Tray, Menu } from "electron";

// Acquire the process-wide lock before any app, window, tray, renderer, or
// background-service initialization. A second launch exits without startup.

import path from "path";
import fs from "fs";
import { setupIPC } from "../ipc/handlers";
import { setupCleanerIPC } from "../ipc/cleaner/cleanerHandlers";
import { setupMemoryIPC } from "../ipc/memory/memoryHandlers";
import { setupEntitlementIPC } from "../ipc/auth/entitlementHandlers";
import { setupAuthHandlersIPC } from "../ipc/auth/authHandlers";
import { setupUpdaterIPC } from "../ipc/updater/updaterHandlers";
import { setupMaintenanceIPC } from "../ipc/maintenance/maintenanceHandlers";

import { setupAIIPC } from "../ipc/ai/aiHandlers";
import { setupSystemCheckIPC } from "../ipc/system-check/systemCheckHandlers";
import { setupPermissionsIPC } from "../ipc/permissions/permissionsHandlers";
import { setupExclusionsIPC } from "../ipc/cleaner/exclusionsHandlers";
import { recoverPerformanceModeState } from "../services/memory/performanceModeService";

// Strict Windows GUID / power-plan GUID format validator.
// Power plan GUIDs are always exactly the canonical 8-4-4-4-12 hex format.
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cleanupOrphanedGameMode() {
  const stateFile = path.join(app.getPath('userData'), 'gameModeState.json');
  if (fs.existsSync(stateFile)) {
    try {
      const data = fs.readFileSync(stateFile, 'utf8');
      const state = JSON.parse(data);
      if (state.gameModeActive && state.originalPowerPlanGuid) {
        const guid = String(state.originalPowerPlanGuid);

        // SECURITY: Validate GUID format before passing to exec to prevent
        // command injection via a tampered gameModeState.json file.
        if (!GUID_RE.test(guid)) {
          console.error('[GameMode Cleanup] Rejected invalid GUID format — possible tamper:', guid.slice(0, 36));
          fs.unlinkSync(stateFile);
          return;
        }

        console.log('[GameMode Cleanup] Restoring orphaned power plan...');
        const { exec } = require('child_process');
        await new Promise((resolve) => {
          // GUID is validated above — safe to interpolate.
          exec(`powercfg /setactive ${guid}`, { windowsHide: true }, () => resolve(true));
        });
      }
      fs.unlinkSync(stateFile);
      console.log('[GameMode Cleanup] Orphaned state file removed.');
    } catch (e) {
      console.error('[GameMode Cleanup] Failed:', e);
    }
  }
}

import { startScheduler, stopScheduler } from "../services/maintenance/schedulerService";
import { loadSettingsSync } from "../services/maintenance/automationStore";
import { startNotificationService, stopNotificationService } from "../services/maintenance/notificationService";
import {
  initMainTelemetry,
  setTelemetryEnabled,
  captureMainError,
} from "../services/telemetry/mainTelemetry";
import { verifyIntegrity } from "../security/integrityVerifier";
import { getAppIconPath } from "./icon";

// Acquire the process-wide lock before any Electron app initialization.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  app.quit();
} else {

// ── Init telemetry FIRST — before any window or IPC setup ─────────
initMainTelemetry();

// Maintain backwards compatibility with existing user data/licenses
// stored in the "cleanmaster-pro" folder on Windows AppData.
app.setPath("userData", path.join(app.getPath("appData"), "cleanmaster-pro"));

// Set AppUserModelID before app is ready — required for correct taskbar grouping,
// Alt+Tab identity, and notification icon on Windows.
app.setAppUserModelId("com.cleanmasterpro.desktop");

const __dirname = path
  .dirname(new URL(import.meta.url).pathname)
  .replace(/^\/([A-Z]:)/, "$1");


nativeTheme.themeSource = "dark";
let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let splashReady = false;
let tray: Tray | null = null;
let isQuitting = false;
let shutdownCleanedUp = false;

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function showMainWindowWhenReady(): void {
  if (!mainWindow || !rendererReady || !splashReady) return;
  mainWindow.show();
  mainWindow.focus();
}

app.on("second-instance", (_event, commandLine) => {
  focusMainWindow();

  // Preserve the existing deep-link handoff without reloading the renderer.
  const url = commandLine.find((arg) => arg.startsWith("propel://"));
  if (url && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("auth:callback", url);
  }
});

ipcMain.on("splash:ready", (event) => {
  if (event.sender !== mainWindow?.webContents) return;
  splashReady = true;
  showMainWindowWhenReady();
});

function createTray(): void {
  if (tray) return; // avoid duplicate tray instance
  const iconPath = getAppIconPath();
  if (!iconPath) return;
  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Open Propel", click: focusMainWindow },
      { type: "separator" },
      { label: "Quit Propel", click: quitPropel },
    ]);
    tray.setToolTip("Propel");
    tray.setContextMenu(contextMenu);
    tray.on("double-click", focusMainWindow);
  } catch (err) {
    console.error("[Tray] Failed to create tray icon:", err);
  }
}

function destroyTray(): void {
  if (tray) {
    try { tray.destroy(); } catch { /* already destroyed */ }
    tray = null;
  }
}

function cleanupBeforeQuit(): void {
  if (shutdownCleanedUp) return;
  shutdownCleanedUp = true;
  stopNotificationService();
  stopScheduler();
  destroyTray();
}

function destroyApplicationWindows(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.destroy();
  }
}

function quitPropel(): void {
  isQuitting = true;
  cleanupBeforeQuit();
  destroyApplicationWindows();
  app.quit();
}

function createWindow(): void {
  // Create the main window
  rendererReady = false;
  splashReady = false;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: false,
    backgroundColor: "#F5F6F1",
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      // sandbox: false is required because several Electron services (memoryService,
      // performanceModeService, cleaner) use native Node APIs (child_process, fs, si)
      // which are incompatible with the renderer-level sandbox. The renderer itself
      // never receives Node access — contextIsolation + a strict preload enforce the
      // security boundary instead. Revisit if native deps are ever replaced with
      // IPC-only shims.
      sandbox: false,
      webSecurity: true,
    },
    show: false,
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
  });

  // Size the native window before the first paint so the compositor never
  // presents an unthemed intermediate frame during startup.
  mainWindow.maximize();

  mainWindow.once("ready-to-show", () => {
    rendererReady = true;
    showMainWindowWhenReady();
  });

  mainWindow.on("closed", () => {
    // When the window is closed
    mainWindow = null;
  });

  // Prevent app quit when user clicks X — hide window instead for background mode
  mainWindow.on("close", (event) => {
    if (isQuitting) return; // allow actual quit to proceed
    if (!loadSettingsSync().runInBackground) {
      quitPropel();
      return;
    }
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Handle external links
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL); // Load the dev server
  } else if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173"); // Load the dev server
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html")); // Load the production build
  }
}

ipcMain.on("window:minimize", () => mainWindow?.minimize()); // Minimize the window
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on("window:close", () => mainWindow?.close()); // Close the window

// tray / background cleanup on actual quit
app.on("before-quit", () => {
  isQuitting = true;
  cleanupBeforeQuit();
  destroyApplicationWindows();
});

app.on("will-quit", () => {
  // Keep cleanup idempotent and ensure no application-owned resources remain
  // when the main process is about to terminate.
  cleanupBeforeQuit();
});

app.on("window-all-closed", () => {
  // With tray background mode, keep the app alive on Windows
  // so notifications continue when the window is hidden.
  if (process.platform === "darwin") app.quit();
});

// ── Global uncaught/unhandled handlers (belt + suspenders over Sentry) ────
process.on("uncaughtException", (err) => {
  captureMainError(err, "main-process-uncaught");
  console.error("[main] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  captureMainError(err, "main-process-unhandled-rejection");
  console.error("[main] Unhandled rejection:", reason);
});

// ── Telemetry opt-out IPC ─────────────────────────────────────────
ipcMain.handle("telemetry:set-enabled", (_event, enabled: boolean) => {
  setTelemetryEnabled(enabled);
  return { ok: true };
});

app.whenReady().then(async () => {
  // When the app is ready
  // ── INTEGRITY CHECK: must run before ANY window or service setup ────────
  // No-op in dev (app.isPackaged === false). Exits with code 1 if tampered.
  await verifyIntegrity();

  // Run Game Mode legacy cleanup before UI loads
  await cleanupOrphanedGameMode();

  // Run Performance Mode crash recovery before UI loads
  await recoverPerformanceModeState();

  setupIPC();
  setupCleanerIPC();
  setupMemoryIPC();
  setupEntitlementIPC();
  setupAuthHandlersIPC();
  setupUpdaterIPC();
  setupMaintenanceIPC();

  setupAIIPC();
  setupSystemCheckIPC();
  setupPermissionsIPC();
  setupExclusionsIPC();
  startScheduler();
  startNotificationService();
  createWindow();
  createTray();

  app.on("activate", () => {
    // When the app is activated
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ── Protocol Registration ───────────────────────────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("propel", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("propel");
}

app.on("open-url", (event, url) => {
  // macOS deep linking
  event.preventDefault();
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    if (url.startsWith("propel://")) {
      console.log("[AUTH] Deep link received (open-url)");
      const hasCode = url.includes("code=");
      console.log(`[AUTH] Code extracted: ${hasCode}`);
      console.log("[AUTH] Sending code to renderer");
      mainWindow.webContents.send("auth:callback", url);
    }
  }
});
}
