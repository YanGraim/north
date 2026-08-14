import { isNewerVersion } from '@shared/lib/semver'

/** Entries strictly newer than `afterVersion` and up to `currentVersion` (inclusive). */
export function filterWhatsNewEntries<T extends { version: string }>(
  entries: readonly T[],
  afterVersion: string | null | undefined,
  currentVersion: string
): T[] {
  if (!afterVersion) return []

  return entries.filter((entry) => {
    const afterSeen = isNewerVersion(entry.version, afterVersion)
    const notAfterCurrent = !isNewerVersion(entry.version, currentVersion)
    return afterSeen && notAfterCurrent
  })
}
