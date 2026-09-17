import { BrowserWindow } from 'electron'
import path from 'path'
import si from 'systeminformation'
import { captureServiceError, captureServiceWarning } from '../telemetry/serviceCapture'


let overlayWin:    BrowserWindow | null               = null
let metricsTimer:  ReturnType<typeof setInterval> | null = null

const W = 224
const H = 148

// ── URL helper ─────────────────────────────────────────────────────────────
function overlayURL(): string {
  const _dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1')
  const base  = process.env.VITE_DEV_SERVER_URL
    ?? `file://${path.join(_dir, '../renderer/index.html')}`
  return `${base}?mode=overlay`
}

// ── Metric push (1 Hz) ─────────────────────────────────────────────────────
async function pushMetrics(): Promise<void> {
  if (!overlayWin || overlayWin.isDestroyed()) return
  try {
    const [load, mem, nets] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats(),
    ])
    const net = Array.isArray(nets) ? nets[0] : nets
    overlayWin.webContents.send('overlay:metrics', {
      cpu:      Math.round(load.currentLoad),
      ram:      Math.round((mem.used / mem.total) * 100),
      netDown:  Math.round(net?.rx_sec ?? 0),
      netUp:    Math.round(net?.tx_sec ?? 0),
    })
  } catch (err) {
    // Metric polling errors are usually transient (GPU/SI unavailable)
    // Only capture if they recur repeatedly — warn level only
    captureServiceWarning('Overlay metric polling failed', {
      service:   'overlay',
      operation: 'pushMetrics',
      phase:     'poll',
    })
  }
}

function startMetrics(): void {
  if (metricsTimer) return
  metricsTimer = setInterval(() => { pushMetrics().catch(() => {}) }, 1000)
}

function stopMetrics(): void {
  if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null }
}

// ── Window lifecycle ───────────────────────────────────────────────────────
export function openOverlay(preloadPath: string): void {
  if (overlayWin && !overlayWin.isDestroyed()) return

  try {
    overlayWin = new BrowserWindow({
      width:    W,
      height:   H,
      frame:    false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable:   false,
      movable:     true,
      webPreferences: {
        preload:          preloadPath,
        nodeIntegration:  false,
        contextIsolation: true,
        sandbox:          false,
      },
      show: false,
    })

    overlayWin.loadURL(overlayURL())

    overlayWin.once('ready-to-show', () => {
      overlayWin?.setAlwaysOnTop(true, 'floating')
      overlayWin?.show()
    })

    overlayWin.on('closed', () => {
      overlayWin = null
      stopMetrics()
    })

    startMetrics()
  } catch (err) {
    captureServiceError(err, {
      service:   'overlay',
      operation: 'openOverlay',
      phase:     'create',
      severity:  'medium',
      extra: { preloadExists: String(!!preloadPath) },
    })
  }
}

export function closeOverlay(): void {
  stopMetrics()
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.close()
    overlayWin = null
  }
}

export function isOverlayOpen(): boolean {
  return !!overlayWin && !overlayWin.isDestroyed()
}
