import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1')

/**
 * Resolves the official Propel icon path.
 * - Production: bundled via extraResources to process.resourcesPath/icon.ico
 * - Development: located at <project-root>/src/assets/icons/propel.ico
 */
export function getAppIconPath(): string | undefined {
  if (app.isPackaged) {
    const prodPath = path.join(process.resourcesPath, 'icon.ico')
    if (fs.existsSync(prodPath)) return prodPath
  }

  const devCandidates = [
    path.resolve(__dirname, '../../src/assets/icons/propel.ico'),
    path.join(app.getAppPath(), 'src/assets/icons/propel.ico'),
    path.resolve(process.cwd(), 'src/assets/icons/propel.ico'),
  ]

  for (const candidate of devCandidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  return undefined
}
