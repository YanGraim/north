import type { LogFollowSnapshot } from '@shared/types'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LogFollowView } from './LogFollowView'

export function LogFollowWindowPage(): React.JSX.Element {
  const { followId } = useParams()
  const [follow, setFollow] = useState<LogFollowSnapshot | null>(null)

  useEffect(() => {
    if (!followId) return
    let cancelled = false
    const apply = (list: LogFollowSnapshot[]): void => {
      if (!cancelled) setFollow(list.find((item) => item.id === followId) ?? null)
    }
    void window.north.logFollows.list().then(apply)
    const unsubscribe = window.north.logFollows.onChanged(apply)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [followId])

  useEffect(() => {
    if (!follow) return
    const name = follow.label?.trim() || follow.path.split('/').pop() || follow.path
    document.title = `${follow.connectionName} — ${name}`
  }, [follow])

  if (!follow) {
    return <div className="h-screen bg-background" data-testid="log-follow-window" />
  }

  return (
    <div
      className="flex h-screen flex-col bg-background text-foreground"
      data-testid="log-follow-window"
    >
      <LogFollowView follow={follow} variant="window" />
    </div>
  )
}
