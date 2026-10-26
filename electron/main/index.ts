import { app, BrowserWindow, ipcMain, shell, nativeTheme, Tray, Menu, screen } from "electron";

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

import { runScheduledIfDue, syncWindowsTask, removeWindowsTask } from "../services/maintenance/schedulerService";
import { getCachedEntitlementSync } from "../services/auth/entitlementCache";
import { loadSettingsSync } from "../services/maintenance/automationStore";
import { startNotificationService, stopNotificationService } from "../services/maintenance/notificationService";
import {
  initMainTelemetry,
  setTelemetryEnabled,
  captureMainError,
} from "../services/telemetry/mainTelemetry";
import { verifyIntegrity } from "../security/integrityVerifier";
import { getAppIconPath } from "./icon";
import { migrateLegacyAppDataFiles, logStartupStoragePaths } from "../utils/userData";

// Detect scheduled maintenance launch — must happen BEFORE the single-instance
// lock so we can hand off to a running primary instance if one exists.
const isScheduledRun = process.argv.includes('--scheduled-maintenance');

// Acquire the process-wide lock before any Electron app initialization.
// For --scheduled-maintenance: if Propel is already running, the new process
// exits immediately and the primary instance receives the args via second-instance.
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
  // Another Propel instance is already running.
  // The second-instance event on the primary will handle the --scheduled-maintenance
  // flag and call runScheduledIfDue() there — no duplicate cleanup will occur.
  app.quit();
} else {

// ── Init telemetry FIRST — before any window or IPC setup ─────────
initMainTelemetry();

// Maintain backwards compatibility with existing user data/licenses
// stored in the "propel" folder on Windows AppData.
app.setPath("userData", path.join(app.getPath("appData"), "propel"));

// Set AppUserModelID before app is ready — required for correct taskbar grouping,
// Alt+Tab identity, and notification icon on Windows.
app.setAppUserModelId("com.propel.desktop");

const __dirname = path
  .dirname(new URL(import.meta.url).pathname)
  .replace(/^\/([A-Z]:)/, "$1");


// Follow Windows until the renderer sends the user's choice via "theme:set"
// (needed so the renderer can read the real Windows theme for "system").
nativeTheme.themeSource = "system";
let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let splashReady = false;
let tray: Tray | null = null;
let isQuitting = false;
let shutdownCleanedUp = false;
let isHiddenStartup = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;
// ── First reveal strategy (startup resize flicker) ────────────────────
// Chromium applies the maximized state inside Show, so the window becomes
// visible at its normal size and is resized right after (trace: two
// OnWindowPosChanged within ~25ms of Show). PROPEL_REVEAL_MODE picks how the
// FIRST reveal hides that; later show/hide calls are plain show().
//   opacity (default) : show at opacity 0, wait until resizes settle and the
//                       renderer presented 2 frames, then opacity 1.
//   nomax             : never maximize; the window already has work-area
//                       bounds, so show() causes no resize at all.
//   current           : maximize() + show() (previous behavior, comparison).
type RevealMode = "opacity" | "nomax" | "current";
const REVEAL_MODE: RevealMode = (() => {
  const v = (process.env.PROPEL_REVEAL_MODE ?? "").trim().toLowerCase();
  return v === "nomax" || v === "current" ? v : "opacity";
})();
const REVEAL_SETTLE_MS = 34; // ~2 frames at 60 Hz with no resize/maximize
const REVEAL_HARD_TIMEOUT_MS = 600; // window can never stay invisible longer

let firstRevealDone = false;

/** Classic restore size: 1280x800 (or smaller screen) centered in the area. */
function classicRestoreBounds(area: Electron.Rectangle): Electron.Rectangle {
  const width = Math.min(1280, area.width);
  const height = Math.min(800, area.height);
  return {
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height,
  };
}

function revealWithOpacity(win: BrowserWindow): void {
  let finished = false;
  let generation = 0;
  let settleTimer: NodeJS.Timeout | undefined;

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(settleTimer);
    clearTimeout(hardTimer);
    win.removeListener("resize", onGeometryChange);
    win.removeListener("maximize", onGeometryChange);
    win.removeListener("closed", finish);
    try {
      if (!win.isDestroyed()) win.setOpacity(1);
    } catch {
      /* window gone */
    }
  };

  // Settled = no geometry change for REVEAL_SETTLE_MS, then the renderer has
  // run two animation frames at the final size. Any resize restarts this.
  const waitForPresentedFrame = () => {
    const gen = generation;
    win.webContents
      .executeJavaScript(
        "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))",
      )
      .catch(() => undefined)
      .then(() => {
        if (gen === generation) finish();
      });
  };
  const scheduleSettle = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(waitForPresentedFrame, REVEAL_SETTLE_MS);
  };
  function onGeometryChange() {
    generation++;
    scheduleSettle();
  }

  const hardTimer = setTimeout(finish, REVEAL_HARD_TIMEOUT_MS);
  win.on("resize", onGeometryChange);
  win.on("maximize", onGeometryChange);
  win.once("closed", finish);

  try {
    win.setOpacity(0);
    win.maximize(); // also shows the window (at opacity 0)
    if (!win.isVisible()) win.show();
    scheduleSettle();
  } catch {
    finish(); // never leave the window transparent
  }
}

function revealMainWindow(win: BrowserWindow): void {
  if (firstRevealDone) {
    // After the first reveal: normal show, no opacity tricks.
    if (!win.isVisible()) win.show();
    return;
  }
  firstRevealDone = true;

  if (REVEAL_MODE === "opacity") {
    revealWithOpacity(win);
  } else if (REVEAL_MODE === "nomax") {
    if (!win.isVisible()) win.show(); // created at work-area bounds: no resize
  } else {
    win.maximize(); // "current": window already has work-area bounds
    if (!win.isVisible()) win.show();
  }
}

function focusMainWindow(): void {
  isHiddenStartup = false; // User manually requested the window
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  // If the renderer/splash isn't ready yet, returning here is safe because
  // clearing isHiddenStartup guarantees showMainWindowWhenReady() will show it later.
  if (!rendererReady || !splashReady) return;
  
  if (mainWindow.isMinimized()) mainWindow.restore();
  revealMainWindow(mainWindow);
  mainWindow.focus();
}

function showMainWindowWhenReady(): void {
  if (!mainWindow || !rendererReady || !splashReady) return;
  if (isHiddenStartup) return;
  
  revealMainWindow(mainWindow);
  mainWindow.focus();
}

app.on("second-instance", (_event, commandLine) => {
  // ── Scheduled-maintenance handoff ─────────────────────────────────────
  // When the Windows Task Scheduler fires Propel.exe --scheduled-maintenance
  // and Propel is ALREADY running, the new process exits immediately and we
  // arrive here. Run the due-check in the existing primary process — this
  // guarantees exactly ONE cleanup execution, no duplicate process spawned.
  if (commandLine.includes('--scheduled-maintenance')) {
    runScheduledIfDue().catch(() => {})
    return // do NOT focus the window for a scheduled background run
  }

  // Normal second-instance: focus the existing window.
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
  firstRevealDone = false;
  // Lay out at the final (maximized) size while hidden, so the reveal does
  // not trigger a resize/reflow on the first visible frame.
  const workArea = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: Math.max(1100, workArea.width),
    height: Math.max(700, workArea.height),
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: false,
    // Same as the light --c-surface-base token (first painted UI color).
    // "theme:set" switches it for dark before the window is revealed.
    backgroundColor: THEME_WINDOW_BG.light,
    paintWhenInitiallyHidden: true,
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

  mainWindow.once("ready-to-show", () => {
    rendererReady = true;
    showMainWindowWhenReady();
  });

  // The window is created at work-area size (so the hidden first layout
  // matches the maximized reveal). Keep the classic restore size: the first
  // un-maximize goes to 1280x800 centered instead of a full-size no-op.
  mainWindow.once("unmaximize", () => {
    const win = mainWindow;
    if (!win || win.isDestroyed()) return;
    const { width, height } = win.getBounds();
    if (width < workArea.width || height < workArea.height) return;
    win.setBounds(classicRestoreBounds(workArea));
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
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        shell.openExternal(url);
      } else {
        console.warn("[setWindowOpenHandler] Blocked unsafe protocol:", parsed.protocol);
      }
    } catch {
      console.warn("[setWindowOpenHandler] Blocked invalid URL:", url);
    }
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
  if (REVEAL_MODE === "nomax" && mainWindow && !mainWindow.isDestroyed()) {
    // No OS maximize in this mode: "maximized" = work-area bounds.
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize(); // native maximize (double-click / Win+Up)
      return;
    }
    const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    const b = mainWindow.getBounds();
    const fillsArea = b.width >= area.width && b.height >= area.height;
    mainWindow.setBounds(fillsArea ? classicRestoreBounds(area) : area);
    return;
  }
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

// ── Theme IPC: renderer reports the user's theme mode ─────────────
// Validated: only "light" | "dark" | "system". Sets nativeTheme and the
// main window background (window is shown only after splash:ready, so the
// background is right before the first visible frame).
const THEME_WINDOW_BG = { light: "#F2F5EF", dark: "#0D100C" } as const;
ipcMain.handle("theme:set", (event, mode: unknown) => {
  if (mode !== "light" && mode !== "dark" && mode !== "system") {
    return { ok: false, dark: nativeTheme.shouldUseDarkColors };
  }
  nativeTheme.themeSource = mode;
  const dark = nativeTheme.shouldUseDarkColors;
  if (mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents) {
    mainWindow.setBackgroundColor(dark ? THEME_WINDOW_BG.dark : THEME_WINDOW_BG.light);
  }
  return { ok: true, dark };
});

// ── Telemetry opt-out IPC ─────────────────────────────────────────
ipcMain.handle("telemetry:set-enabled", (_event, enabled: boolean) => {
  setTelemetryEnabled(enabled);
  return { ok: true };
});

app.whenReady().then(async () => {
  // Storage initialization: migrate legacy files and log storage paths
  migrateLegacyAppDataFiles();
  logStartupStoragePaths();

  // ── INTEGRITY CHECK: must run before ANY window or service setup ────────
  // No-op in dev (app.isPackaged === false). Exits with code 1 if tampered.
  await verifyIntegrity();

  // ── Scheduled-maintenance hidden launch ──────────────────────────────────
  // When launched by Windows Task Scheduler with --scheduled-maintenance:
  //   1. No window, no tray, no splash is created.
  //   2. Run the double-protected due-check (scheduleEnabled + rolling interval).
  //   3. Exit cleanly whether or not cleanup ran.
  // This path only reaches here if no other Propel instance was running —
  // the single-instance lock above already handled the handoff case.
  if (isScheduledRun) {
    const entitlement = getCachedEntitlementSync();
    if (!entitlement.features?.alwaysOnMaintenance) {
      console.log('[ScheduledMaintenance] Not entitled to alwaysOnMaintenance. Removing task and exiting.');
      await removeWindowsTask();
      app.quit();
      return;
    }

    // Still need IPC + maintenance handlers in case runAutoClean() needs them,
    // but we deliberately skip window, tray, and notification service.
    setupMaintenanceIPC();
    try {
      await runScheduledIfDue();
    } catch { /* non-fatal — log silently */ }
    app.quit();
    return;
  }

  // ── Normal interactive launch ────────────────────────────────────────────
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

  // ── Sync Windows Task Scheduler on every normal launch ──────────────────
  // This is idempotent (/f flag) — safe to call every time. It ensures:
  //   - Task is created if scheduleEnabled=true and task was missing
  //     (e.g., after a fresh install or update).
  //   - Task is removed if scheduleEnabled=false.
  //   - Executable path in the task stays current after updates.
  syncWindowsTask(app.getPath('exe')).catch(() => {});

  startNotificationService();
  createWindow();
  createTray();

  app.on("activate", () => {
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
