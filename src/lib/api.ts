/**
 * Backend URL for the renderer. The value comes from preload
 * (electron/config/api.ts, fixed at build time). Do not hardcode URLs here.
 */
export function apiUrl(path: string): string {
  const base = window.electronAPI.config.apiBase
  return `${base}/api${path.startsWith('/') ? path : `/${path}`}`
}
