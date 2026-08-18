/** Two-letter initials from a display name. */
export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase()
}

export function effectiveDisplayName(displayName: string, osUsername: string | null): string {
  const trimmed = displayName.trim()
  if (trimmed) return trimmed
  const fallback = osUsername?.trim()
  if (fallback) return fallback
  return 'User'
}
