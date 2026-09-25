import { app, BrowserWindow, ipcMain, shell, nativeTheme } from "electron";
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

import { startScheduler } from "../services/maintenance/schedulerService";
import { startNotificationService } from "../services/maintenance/notificationService";
import {
  initMainTelemetry,
  setTelemetryEnabled,
  captureMainError,
} from "../services/telemetry/mainTelemetry";
import { verifyIntegrity } from "../security/integrityVerifier";

// ── Init telemetry FIRST — before any window or IPC setup ─────────────────
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

import { getAppIconPath } from "./icon";

let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let splashReady = false;

function showMainWindowWhenReady(): void {
  if (!mainWindow || !rendererReady || !splashReady) return;
  mainWindow.show();
  mainWindow.focus();
}

ipcMain.on("splash:ready", (event) => {
  if (event.sender !== mainWindow?.webContents) return;
  splashReady = true;
  showMainWindowWhenReady();
});

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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
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

// ── Telemetry opt-out IPC ─────────────────────────────────────────────────
ipcMain.handle("telemetry:set-enabled", (_event, enabled: boolean) => {
  setTelemetryEnabled(enabled);
  return { ok: true };
});

app.whenReady().then(async () => {
  // When the app is ready
  // ── INTEGRITY CHECK: must run before ANY window or service setup ────────
  // No-op in dev (app.isPackaged === false). Exits with code 1 if tampered.
  await verifyIntegrity();

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

if (!app.requestSingleInstanceLock()) {
  // If another instance is already running
  app.quit();
}

app.on("second-instance", (event, commandLine, workingDirectory) => {
  // When another instance is launched
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    // Windows/Linux deep linking
    const url = commandLine.find((arg) => arg.startsWith("propel://"));
    if (url) {
      console.log("[AUTH] Deep link received (second-instance)");
      const hasCode = url.includes("code=");
      console.log(`[AUTH] Code extracted: ${hasCode}`);
      console.log("[AUTH] Sending code to renderer");
      mainWindow.webContents.send("auth:callback", url);
    }
  }
});

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
