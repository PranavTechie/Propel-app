import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export const APP_DATA_FILES = [
  'propel_device_id.json',
  'propel_license.json',
  'propel_exclusions.json',
  'propel_maintenance.json',
  'propel_entitlement.json',
] as const

export type AppDataFileName = typeof APP_DATA_FILES[number]

/**
 * Returns the canonical userData directory for Propel (%APPDATA%\propel).
 * Ensures the directory exists recursively.
 */
export function getUserDataDir(): string {
  const dir = app?.getPath ? app.getPath('userData') : path.join(process.env.APPDATA ?? os.homedir(), 'propel')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Returns the legacy root Roaming directory (%APPDATA%).
 */
export function getLegacyRoamingDir(): string {
  return process.env.APPDATA ?? os.homedir()
}

/**
 * Returns the target file path within userData directory for a given filename.
 */
export function getAppDataFilePath(fileName: AppDataFileName): string {
  return path.join(getUserDataDir(), fileName)
}

export function getDeviceIdFilePath(): string {
  return getAppDataFilePath('propel_device_id.json')
}

export function getLicenseFilePath(): string {
  return getAppDataFilePath('propel_license.json')
}

export function getExclusionsFilePath(): string {
  return getAppDataFilePath('propel_exclusions.json')
}

export function getMaintenanceFilePath(): string {
  return getAppDataFilePath('propel_maintenance.json')
}

export function getEntitlementFilePath(): string {
  return getAppDataFilePath('propel_entitlement.json')
}

/**
 * One-time startup migration:
 * For each of the 4 files:
 * - If target path in userData is missing AND legacy root file exists:
 *   MOVE it (byte-identical copy + unlink) preserving device_id, registered_at, etc.
 * - If both exist: keep the new one and leave the old one untouched (log it). Never overwrite.
 */
export function migrateLegacyAppDataFiles(): void {
  const targetDir = getUserDataDir()
  const legacyDir = getLegacyRoamingDir()

  for (const fileName of APP_DATA_FILES) {
    const newPath = path.join(targetDir, fileName)
    const oldPath = path.join(legacyDir, fileName)

    const newExists = fs.existsSync(newPath)
    const oldExists = fs.existsSync(oldPath)

    if (newExists && oldExists) {
      console.log(`[STORAGE MIGRATION] Both new and legacy files exist for "${fileName}". Keeping new file (${newPath}), leaving legacy untouched (${oldPath}).`)
    } else if (!newExists && oldExists) {
      try {
        fs.copyFileSync(oldPath, newPath)
        fs.unlinkSync(oldPath)
        console.log(`[STORAGE MIGRATION] Successfully moved "${fileName}" from legacy path (${oldPath}) to userData (${newPath}).`)
      } catch (err) {
        console.warn(`[STORAGE MIGRATION] Failed to migrate "${fileName}" from ${oldPath} to ${newPath}:`, err)
      }
    }
  }
}

/**
 * Logs startup paths for userData and all four files.
 */
export function logStartupStoragePaths(): void {
  const dir = getUserDataDir()
  console.log(`[STORAGE] userData path: "${dir}"`)
  console.log(`[STORAGE] device_id path: "${getDeviceIdFilePath()}"`)
  console.log(`[STORAGE] license path: "${getLicenseFilePath()}"`)
  console.log(`[STORAGE] exclusions path: "${getExclusionsFilePath()}"`)
  console.log(`[STORAGE] maintenance path: "${getMaintenanceFilePath()}"`)
}
