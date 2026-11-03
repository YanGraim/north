import { isSafePosixAbsolute } from './selection-path'
import { canonicalPosixDir } from './startup-directory'

/**
 * OSC 7 payload: `file://<host>/<absolute-path>`.
 * The host is ignored. The path is percent-decoded and must be a safe POSIX absolute.
 * An empty path stays empty — it never becomes `/`.
 */
const FILE_URI = /^file:\/\/([^/?#]*)(\/[^?#]*)?$/i

export function parseOsc7Cwd(payload: string): string | null {
  if (typeof payload !== 'string' || payload.length === 0) return null
  const match = FILE_URI.exec(payload)
  if (!match) return null
  const rawPath = match[2]
  if (rawPath == null || rawPath.length === 0) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(rawPath)
  } catch {
    return null
  }
  if (decoded.length === 0) return null

  const canonical = canonicalPosixDir(decoded)
  if (!isSafePosixAbsolute(canonical)) return null
  return canonical
}

/**
 * Keeps the previous cwd when the payload is not a new absolute path.
 * The same path returns the same string so the caller can skip another listing.
 */
export function nextOsc7Cwd(current: string | null, payload: string): string | null {
  const parsed = parseOsc7Cwd(payload)
  if (parsed == null || parsed === current) return current
  return parsed
}
