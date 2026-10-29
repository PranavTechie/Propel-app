import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import os from 'os'

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
