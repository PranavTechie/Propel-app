/**
 * Local auth state on disk (main process). Pure: paths and fs are passed in,
 * so it can be unit-tested without Electron.
 *
 * On logout / "no valid session" this removes everything that could make the
 * app look logged in on the next start:
 *  - propel_entitlement.json  cached plan (never proof of login)
 *  - propel_license.json      legacy per-account license key
 *  - propel_device_id.json    keeps the stable device_id, removes registered_at
 */
export interface LocalAuthPaths {
  entitlement: string
  license: string
  deviceId: string
}

export interface FsLike {
  unlink(path: string): Promise<void>
  readFile(path: string, encoding: 'utf8'): Promise<string>
  writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>
}

export interface ClearLocalAuthResult {
  ok: boolean
  cleared: string[]
  failed: string[]
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
}

export async function clearLocalAuthFilesAt(
  paths: LocalAuthPaths,
  fsImpl: FsLike,
): Promise<ClearLocalAuthResult> {
  const cleared: string[] = []
  const failed: string[] = []

  for (const [name, file] of [
    ['entitlement', paths.entitlement],
    ['license', paths.license],
  ] as const) {
    try {
      await fsImpl.unlink(file)
      cleared.push(name)
    } catch (err) {
      if (isMissing(err)) cleared.push(name)
      else failed.push(name)
    }
  }

  // Device id stays (stable device identity, file shape unchanged);
  // only the registration marker for the logged-out account is removed.
  try {
    const raw = await fsImpl.readFile(paths.deviceId, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if ('registered_at' in parsed) {
      delete parsed.registered_at
      await fsImpl.writeFile(paths.deviceId, JSON.stringify(parsed), 'utf8')
    }
    cleared.push('deviceRegistration')
  } catch (err) {
    if (isMissing(err)) cleared.push('deviceRegistration')
    else failed.push('deviceRegistration')
  }

  return { ok: failed.length === 0, cleared, failed }
}
