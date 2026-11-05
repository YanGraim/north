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

/** One clickable piece of a path bar. `path` is the directory that piece opens. */
export type PathSegment = {
  label: string
  path: string
}

/**
 * Splits a listed directory into breadcrumb segments, root first.
 * A trailing separator does not add an empty piece. Windows drive roots keep
 * the trailing backslash (`C:\`), matching `parentPath`.
 */
export function pathSegments(path: string, sep: PathStyle): PathSegment[] {
  if (sep === '/') return posixSegments(path)
  return windowsSegments(path)
}

function posixSegments(path: string): PathSegment[] {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path
  if (trimmed === '' || trimmed === '/') return [{ label: '/', path: '/' }]
  const absolute = trimmed.startsWith('/')
  const names = trimmed.split('/').filter((name) => name.length > 0)
  const segments: PathSegment[] = []
  if (absolute) segments.push({ label: '/', path: '/' })
  let acc = ''
  for (const name of names) {
    acc = acc === '' ? `${absolute ? '/' : ''}${name}` : `${acc}/${name}`
    segments.push({ label: name, path: acc })
  }
  return segments.length > 0 ? segments : [{ label: '/', path: '/' }]
}

function windowsSegments(path: string): PathSegment[] {
  // UNC paths are not a drive root. Keep them as one piece so a click cannot
  // navigate to a prefix that dropped the leading slashes.
  if (path.startsWith('\\\\')) return [{ label: path, path }]
  if (isRoot(path, '\\')) return [windowsRoot(path)]
  const trimmed = path.replace(/\\+$/, '')
  if (trimmed === '' || isRoot(trimmed, '\\')) return [windowsRoot(trimmed || path)]
  const drive = trimmed.match(/^([A-Za-z]:)/)
  const segments: PathSegment[] = []
  let rest = trimmed
  let acc = ''
  if (drive) {
    const root = `${drive[1]}\\`
    segments.push({ label: root, path: root })
    rest = trimmed.slice(drive[0].length).replace(/^\\+/, '')
    acc = root
  }
  for (const name of rest.split('\\').filter((part) => part.length > 0)) {
    acc = acc === '' ? name : acc.endsWith('\\') ? `${acc}${name}` : `${acc}\\${name}`
    segments.push({ label: name, path: acc })
  }
  return segments.length > 0 ? segments : [{ label: path, path }]
}

function windowsRoot(path: string): PathSegment {
  const drive = path.match(/^([A-Za-z]:)/)
  if (drive) return { label: `${drive[1]}\\`, path: `${drive[1]}\\` }
  return { label: '\\', path: '\\' }
}

export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
