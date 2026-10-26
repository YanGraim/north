/**
 * Path helpers shared by both panes. Remote paths are always POSIX; local
 * paths use the OS separator (`\` on Windows, with `C:\` style roots).
 */
export type PathStyle = '/' | '\\'

function isRoot(path: string, sep: PathStyle): boolean {
  if (sep === '/') return path === '/'
  return /^[A-Za-z]:\\?$/.test(path) || path === '\\'
}

export function joinPath(base: string, name: string, sep: PathStyle): string {
  if (base.endsWith(sep)) return `${base}${name}`
  return `${base}${sep}${name}`
}

export function parentPath(path: string, sep: PathStyle): string {
  if (isRoot(path, sep)) return path
  const trimmed = path.endsWith(sep) ? path.slice(0, -1) : path
  const idx = trimmed.lastIndexOf(sep)
  if (sep === '/') return idx <= 0 ? '/' : trimmed.slice(0, idx)
  // `C:\foo` → `C:\`; never strip the drive's trailing backslash.
  if (idx <= 2) return `${trimmed.slice(0, 2)}\\`
  return trimmed.slice(0, idx)
}

export function isRootPath(path: string, sep: PathStyle): boolean {
  return isRoot(path, sep)
}

export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
