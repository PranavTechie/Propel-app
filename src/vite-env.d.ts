/// <reference types="vite/client" />

/**
 * Vite environment variable typings for Propel renderer.
 *
 * All VITE_* variables here are injected at build time by Vite.
 * Add new variables here whenever you add them to .env.
 *
 * Source: electron-app/.env (or PropelPage/.env for the web build)
 */
interface ImportMetaEnv {
  // Telemetry
  readonly VITE_GLITCHTIP_DSN: string

  // App metadata
  readonly VITE_APP_VERSION: string

  // Force telemetry in dev (set to '1' to enable)
  readonly VITE_FORCE_TELEMETRY: string

  // Razorpay public key (renderer-safe, non-secret)
  readonly VITE_RAZORPAY_KEY_ID: string

  // Backend API base URL is NOT read here: use apiUrl() from '@/lib/api'
  // (value fixed at build time in electron/config/api.ts, exposed via preload).
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
