import { effectiveDisplayName, profileInitials } from '@renderer/lib/profile'
import { queryKeys } from '@renderer/lib/query-keys'
import { useUiStore } from '@renderer/stores/ui-store'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

export function useLocalProfile(): {
  displayName: string
  profileEmail: string
  effectiveName: string
  initials: string
  setDisplayName: (name: string) => void
  setProfileEmail: (email: string) => void
  osUsername: string | null
} {
  const displayName = useUiStore((s) => s.displayName)
  const profileEmail = useUiStore((s) => s.profileEmail)
  const profileSeeded = useUiStore((s) => s.profileSeeded)
  const setDisplayName = useUiStore((s) => s.setDisplayName)
  const setProfileEmail = useUiStore((s) => s.setProfileEmail)
  const seedProfileFromOs = useUiStore((s) => s.seedProfileFromOs)

  const { data: identity } = useQuery({
    queryKey: queryKeys.app.identity,
    queryFn: () => window.north.getIdentity(),
    staleTime: Number.POSITIVE_INFINITY
  })

  useEffect(() => {
    if (profileSeeded || displayName.trim()) return
    const username = identity?.osUsername?.trim()
    if (!username) return
    seedProfileFromOs(username)
  }, [profileSeeded, displayName, identity?.osUsername, seedProfileFromOs])

  const osUsername = identity?.osUsername ?? null
  const effectiveName = effectiveDisplayName(displayName, osUsername)

  return {
    displayName,
    profileEmail,
    effectiveName,
    initials: profileInitials(effectiveName),
    setDisplayName,
    setProfileEmail,
    osUsername
  }
}
