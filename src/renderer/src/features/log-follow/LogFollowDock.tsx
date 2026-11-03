import type { LogFollowSnapshot } from '@shared/types'
import { useEffect, useState } from 'react'
import { LogFollowView } from './LogFollowView'

export function LogFollowDock(): React.JSX.Element | null {
  const [follows, setFollows] = useState<LogFollowSnapshot[]>([])

  useEffect(() => {
    let cancelled = false
    const apply = (list: LogFollowSnapshot[]): void => {
      if (cancelled) return
      if (!Array.isArray(list)) {
        console.error('log follow update was not a list', list)
        return
      }
      setFollows(list)
    }
    void window.north.logFollows.list().then(apply)
    const unsubscribe = window.north.logFollows.onChanged(apply)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const docked = follows.filter((follow) => follow.placement === 'dock')
  if (docked.length === 0) return null

  return (
    <div
      data-testid="log-follow-dock"
      className="flex h-56 shrink-0 divide-x divide-border overflow-x-auto overflow-y-hidden border-t border-border"
    >
      {docked.map((follow) => (
        <LogFollowView key={follow.id} follow={follow} variant="dock" />
      ))}
    </div>
  )
}
