import path from 'path'
import fs from 'fs/promises'
import type { ScannedFile, ScanProgressCallback } from './scannerService'
import { scanDirectories } from './scannerService'

export const BROWSER_CATEGORY_ID = 'browser-cache'

const CACHE_SUBFOLDERS = ['Cache', 'Cache_Data', 'Code Cache', 'GPUCache', 'ShaderCache']

async function getChromiumCacheDirs(userDataPath: string): Promise<string[]> {
  const dirs: string[] = []
  try {
    const entries = await fs.readdir(userDataPath, { withFileTypes: true })
    for (const entry of entries) {
      const name = String(entry.name)
      if (entry.isDirectory() && (name === 'Default' || name.startsWith('Profile'))) {
        for (const sub of CACHE_SUBFOLDERS) {
          dirs.push(path.join(userDataPath, name, sub))
        }
      }
    }
  } catch {
    // browser not installed or no profiles
  }
  return dirs
}

async function getFirefoxCacheDirs(): Promise<string[]> {
  const dirs: string[] = []
  const profilesPath = path.join(process.env.APPDATA ?? '', 'Mozilla', 'Firefox', 'Profiles')
  try {
    const profiles = await fs.readdir(profilesPath, { withFileTypes: true })
    for (const p of profiles) {
      if (p.isDirectory()) {
        const name = String(p.name)
        dirs.push(path.join(profilesPath, name, 'cache2'))
        dirs.push(path.join(profilesPath, name, 'startupCache'))
        dirs.push(path.join(profilesPath, name, 'thumbnails'))
      }
    }
  } catch {
    // Firefox not installed
  }
  return dirs
}

export async function scanBrowserCache(onProgress: ScanProgressCallback): Promise<ScannedFile[]> {
  const localAppData = process.env.LOCALAPPDATA ?? ''

  const [chrome, edge, brave, firefox] = await Promise.all([
    getChromiumCacheDirs(path.join(localAppData, 'Google', 'Chrome', 'User Data')),
    getChromiumCacheDirs(path.join(localAppData, 'Microsoft', 'Edge', 'User Data')),
    getChromiumCacheDirs(path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data')),
    getFirefoxCacheDirs(),
  ])

  const allDirs = [...chrome, ...edge, ...brave, ...firefox]
  return scanDirectories(allDirs, BROWSER_CATEGORY_ID, onProgress, 2)
}
