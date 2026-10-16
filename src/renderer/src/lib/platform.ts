export function isApplePlatform(
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : ''
): boolean {
  return /Mac|iPhone|iPad|iPod/.test(platform)
}

export function isWindowsPlatform(
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : ''
): boolean {
  return /^Win/.test(platform)
}
