import { execFile as execFileCb } from 'node:child_process'
import { dirname } from 'node:path'
import { promisify } from 'node:util'

const defaultExecFile = promisify(execFileCb)

export type StripQuarantineDeps = {
  platform?: NodeJS.Platform
  execFile?: (file: string, args: readonly string[]) => Promise<unknown>
}

/**
 * Remove macOS quarantine attributes from a downloaded update artifact.
 * No-op outside darwin. xattr failures are logged and ignored so install can proceed.
 */
export async function stripQuarantine(
  targetPath: string,
  deps: StripQuarantineDeps = {}
): Promise<void> {
  const platform = deps.platform ?? process.platform
  if (platform !== 'darwin') return

  const run = deps.execFile ?? defaultExecFile
  const targets = [targetPath, dirname(targetPath)]

  for (const target of targets) {
    try {
      await run('xattr', ['-cr', target])
    } catch (error: unknown) {
      console.warn(`[updates] Failed to strip quarantine from ${target}`, error)
    }
  }
}
