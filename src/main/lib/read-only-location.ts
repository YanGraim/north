/**
 * True when the macOS app runs from a place where it can't replace itself:
 * a mounted DMG (`/Volumes/...`) or Gatekeeper's AppTranslocation (an app opened
 * straight from Downloads gets copied to a read-only randomized path). In both
 * cases the update can't be installed until the app is moved to Applications.
 * Other platforms are never affected.
 */
export function isRunningFromReadOnlyLocation(
  platform: NodeJS.Platform = process.platform,
  execPath: string = process.execPath
): boolean {
  if (platform !== 'darwin') return false
  return execPath.startsWith('/Volumes/') || execPath.includes('/AppTranslocation/')
}
