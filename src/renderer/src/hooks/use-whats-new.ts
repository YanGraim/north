import { getWhatsNewSince, getWhatsNewUpTo, hasWhatsNewSince } from '@renderer/content/whats-new'
import { useAppVersion } from '@renderer/hooks/use-app-version'
import { useUiStore } from '@renderer/stores/ui-store'
import { useWhatsNewStore } from '@renderer/stores/whats-new-store'
import { useEffect, useMemo, useState } from 'react'

function useUiStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useUiStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return
    const unsub = useUiStore.persist.onFinishHydration(() => setHydrated(true))
    setHydrated(useUiStore.persist.hasHydrated())
    return unsub
  }, [hydrated])

  return hydrated
}

/** Boot check + entries for the open dialog (auto or forced). */
export function useWhatsNew(): {
  open: boolean
  forced: boolean
  entries: ReturnType<typeof getWhatsNewSince>
  dismiss: () => void
  close: () => void
} {
  const hydrated = useUiStoreHydrated()
  const { data: version } = useAppVersion()
  const lastSeen = useUiStore((s) => s.lastSeenWhatsNewVersion)
  const setLastSeen = useUiStore((s) => s.setLastSeenWhatsNewVersion)
  const open = useWhatsNewStore((s) => s.open)
  const forced = useWhatsNewStore((s) => s.forced)
  const openWhatsNew = useWhatsNewStore((s) => s.openWhatsNew)
  const closeWhatsNew = useWhatsNewStore((s) => s.closeWhatsNew)

  useEffect(() => {
    if (!hydrated || !version) return

    if (lastSeen == null) {
      setLastSeen(version)
      return
    }

    if (hasWhatsNewSince(lastSeen, version)) {
      openWhatsNew()
      return
    }

    if (lastSeen !== version) {
      setLastSeen(version)
    }
  }, [hydrated, version, lastSeen, setLastSeen, openWhatsNew])

  const entries = useMemo(() => {
    if (!version) return []
    if (forced) {
      const upTo = getWhatsNewUpTo(version)
      if (upTo.length > 0) return upTo
      // Preview in dev when package.json lags the notes folder
      return getWhatsNewUpTo('999.0.0')
    }
    return getWhatsNewSince(lastSeen, version)
  }, [version, forced, lastSeen])

  function dismiss(): void {
    if (version) setLastSeen(version)
    closeWhatsNew()
  }

  return {
    open: open && entries.length > 0,
    forced,
    entries,
    dismiss,
    close: closeWhatsNew
  }
}
