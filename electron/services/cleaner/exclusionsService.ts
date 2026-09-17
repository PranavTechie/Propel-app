import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

export type ExclusionType = 'folder' | 'file' | 'extension' | 'browser' | 'category'

export interface ExclusionEntry {
  id: string
  type: ExclusionType
  value: string    // normalized path for folder/file, ".ext" for extension, browser name, category id
  label: string    // human-readable display name
  addedAt: number
}

export interface ExclusionsConfig {
  version: 1
  entries: ExclusionEntry[]
}

const EXCLUSIONS_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'cm_exclusions.json')

export async function loadExclusions(): Promise<ExclusionsConfig> {
  try {
    const raw = await fs.readFile(EXCLUSIONS_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ExclusionsConfig>
    return {
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    }
  } catch {
    return { version: 1, entries: [] }
  }
}

export async function saveExclusions(config: ExclusionsConfig): Promise<void> {
  await fs.writeFile(EXCLUSIONS_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function buildEntry(entry: Omit<ExclusionEntry, 'id' | 'addedAt'>): ExclusionEntry {
  return {
    id: `excl_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    addedAt: Date.now(),
    ...entry,
  }
}

export function isDuplicate(config: ExclusionsConfig, type: ExclusionType, value: string): boolean {
  const norm = value.toLowerCase().trim()
  return config.entries.some(e => e.type === type && e.value.toLowerCase().trim() === norm)
}

export function removeEntry(config: ExclusionsConfig, id: string): ExclusionsConfig {
  return { ...config, entries: config.entries.filter(e => e.id !== id) }
}

/**
 * Returns true if a given file path should be excluded from cleanup.
 * Checks folder, file, and extension exclusions.
 */
export function isFileExcluded(filePath: string, exclusions: ExclusionEntry[]): boolean {
  const normed  = filePath.replace(/\\/g, '/').toLowerCase()
  const ext     = path.extname(filePath).toLowerCase()

  for (const e of exclusions) {
    if (e.type === 'folder') {
      const folder = e.value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
      if (normed.startsWith(folder + '/') || normed === folder) return true
    } else if (e.type === 'file') {
      if (normed === e.value.replace(/\\/g, '/').toLowerCase()) return true
    } else if (e.type === 'extension') {
      const exclExt = e.value.startsWith('.') ? e.value.toLowerCase() : '.' + e.value.toLowerCase()
      if (ext === exclExt) return true
    }
  }
  return false
}

/**
 * Returns true if an entire category should be skipped.
 * Checks category and browser exclusions.
 */
export function isCategoryExcluded(categoryId: string, exclusions: ExclusionEntry[]): boolean {
  for (const e of exclusions) {
    if (e.type === 'category' && e.value === categoryId) return true
    if (e.type === 'browser' && categoryId === 'browser-cache') return true
  }
  return false
}
