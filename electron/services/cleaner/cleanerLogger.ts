import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import os from 'os'

export interface PassErrorKindCounts {
  locked: number
  'permission-denied': number
  missing: number
  'validation-rejected': number
  'result-unreadable': number
  other: number
}

export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return ''
  let sanitized = msg
  const username = process.env.USERNAME || (os.userInfo ? os.userInfo().username : '')
  if (username && username.length > 1) {
    const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    sanitized = sanitized.replace(new RegExp(escapedUser, 'gi'), '<user>')
  }
  // Strip Windows drive paths (e.g. C:\Users\... or C:/...)
  sanitized = sanitized.replace(/[a-zA-Z]:\\[^\s'"<>|]+/g, '<path>')
  sanitized = sanitized.replace(/[a-zA-Z]:\/[^\s'"<>|]+/g, '<path>')
  // Strip UNC paths
  sanitized = sanitized.replace(/\\\\[^\s'"<>|]+/g, '<path>')
  return sanitized
}

export function countErrorsByKind(
  errors: { kind?: string; reason?: string }[],
  resultUnreadableCount = 0,
): PassErrorKindCounts {
  const counts: PassErrorKindCounts = {
    locked: 0,
    'permission-denied': 0,
    missing: 0,
    'validation-rejected': 0,
    'result-unreadable': resultUnreadableCount,
    other: 0,
  }

  for (const err of errors) {
    const k = err.kind || ''
    if (k === 'locked') counts.locked++
    else if (k === 'permission-denied') counts['permission-denied']++
    else if (k === 'missing') counts.missing++
    else if (k === 'rejected' || k === 'validation-rejected') counts['validation-rejected']++
    else if (k === 'result-unreadable') counts['result-unreadable']++
    else counts.other++
  }

  return counts
}

function getLogPath(): string {
  try {
    const userData = app?.getPath ? app.getPath('userData') : path.join(process.env.APPDATA ?? os.homedir(), 'propel')
    return path.join(userData, 'logs', 'cleaner.log')
  } catch {
    return path.join(os.tmpdir(), 'propel-cleaner.log')
  }
}

export function appendCleanerLog(message: string): void {
  try {
    const logPath = getLogPath()
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    const ts = new Date().toISOString()
    fs.appendFileSync(logPath, `[${ts}] ${message}\n`, 'utf8')
  } catch {
    // Logging should never throw or break cleaning flow
  }
}
