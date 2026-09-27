/**
 * pathGuard.ts
 *
 * Builds a list of protected Windows system directories and exports a predicate
 * that returns true (with a console warning) when a candidate path resolves
 * inside any of those locations.
 *
 * This prevents a misconfigured %TEMP% / %LOCALAPPDATA% environment variable
 * from accidentally directing the cleaner at C:\Windows or similar.
 */

import path from 'path'
import os from 'os'

// ── Build protected-path list once at module load time ──────────────────────

function buildProtectedPaths() {
  const winDir  = (process.env.WINDIR  ?? process.env.SystemRoot ?? 'C:\\Windows').toLowerCase()
  const sysRoot = path.dirname(winDir).toLowerCase()
  const progFiles  = (process.env.ProgramFiles  ?? '').toLowerCase()
  const progFiles86 = (process.env['ProgramFiles(x86)'] ?? '').toLowerCase()
  const progData    = (process.env.ProgramData  ?? '').toLowerCase()
  const sysDir      = path.join(winDir, 'system32').toLowerCase()
  const sysDirWow   = path.join(winDir, 'syswow64').toLowerCase()
  const userProfile = (process.env.USERPROFILE ?? os.homedir()).toLowerCase()

  const norm = (p: string) => path.resolve(p).replace(/\\/g, '/').toLowerCase()

  return {
    exact: [sysRoot, userProfile].filter(Boolean).map(norm),
    recursive: [winDir, sysDir, sysDirWow, progFiles, progFiles86, progData].filter(Boolean).map(norm),
    whitelist: [
      path.join(winDir, 'Temp'),
      path.join(winDir, 'Logs', 'CBS'),
      path.join(winDir, 'Logs', 'DISM'),
      path.join(winDir, 'SoftwareDistribution', 'Download'),
      path.join(winDir, 'SoftwareDistribution', 'DeliveryOptimization'),
      path.join(winDir, 'Prefetch'),
    ].map(norm)
  }
}

const RULES = buildProtectedPaths()

export function isProtectedPath(candidatePath: string): boolean {
  const norm = path.resolve(candidatePath).replace(/\\/g, '/').toLowerCase()

  // 1. Is it explicitly whitelisted? (e.g. C:\Windows\Temp)
  for (const w of RULES.whitelist) {
    if (norm === w || norm.startsWith(w + '/')) return false
  }

  // 2. Is it an exact match for a highly sensitive root? (e.g. C:\)
  if (RULES.exact.includes(norm)) {
    console.warn(`[Cleaner] BLOCKED: path "${candidatePath}" is a protected root directory. Skipping.`)
    return true
  }

  // 3. Is it inside a protected system directory? (e.g. C:\Windows\System32)
  for (const r of RULES.recursive) {
    if (norm === r || norm.startsWith(r + '/')) {
      console.warn(`[Cleaner] BLOCKED: path "${candidatePath}" is inside protected directory "${r}". Skipping.`)
      return true
    }
  }

  return false
}
