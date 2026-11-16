/**
 * Backend API base URL. This file is the ONE place it is defined.
 *
 * Build time: electron.vite.config.ts reads VITE_API_BASE_URL (shell env or .env),
 * falls back to DEFAULT_API_BASE, validates it with normalizeApiBase() and injects
 * it as __PROPEL_API_BASE__ via `define` into the main and preload bundles. It also
 * writes the same origin into the index.html CSP connect-src.
 * Runtime: nothing reads process.env for the API URL. The renderer gets it from
 * preload (window.electronAPI.config.apiBase).
 *
 * DEFAULT_API_BASE is the Render URL because api.cleanmasterpro.in has no DNS
 * record yet (checked 2026-11-16). To switch, change this one value.
 */
export const DEFAULT_API_BASE = 'https://cleanmasterpro-backend-server.onrender.com'

declare const __PROPEL_API_BASE__: string | undefined

/**
 * Returns the base URL without a trailing slash or trailing "/api".
 * Only https is allowed, except http on localhost for local backend development.
 */
export function normalizeApiBase(raw: string): string {
  const url = new URL(String(raw).trim())
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new Error(`API base must be https (got ${url.protocol}//${url.hostname})`)
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new Error('API base must not contain query, hash or credentials')
  }
  const pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '')
  return `${url.origin}${pathname}`
}

/** Base URL, e.g. https://host. Endpoints are `${API_BASE}/api/...`. */
export const API_BASE: string =
  typeof __PROPEL_API_BASE__ === 'string' ? __PROPEL_API_BASE__ : DEFAULT_API_BASE
