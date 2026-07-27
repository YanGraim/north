import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useSelectedConnectionId(): {
  connectionId: string | null
  setConnectionId: (id: string | null) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const connectionId = searchParams.get('connection')

  const setConnectionId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id) {
            next.set('connection', id)
            next.delete('access')
          } else {
            next.delete('connection')
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  return { connectionId, setConnectionId }
}

export function useSelectedAccessId(): {
  accessId: string | null
  setAccessId: (id: string | null) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const accessId = searchParams.get('access')

  const setAccessId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id) {
            next.set('access', id)
            next.delete('connection')
          } else {
            next.delete('access')
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  return { accessId, setAccessId }
}

export function useClientFilters(): {
  environmentId: string | null
  groupId: string | null
  setEnvironmentId: (id: string | null) => void
  setGroupId: (id: string | null) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const environmentId = searchParams.get('env')
  const groupId = searchParams.get('group')

  const patch = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  return {
    environmentId,
    groupId,
    setEnvironmentId: (id) =>
      patch((params) => {
        if (id) params.set('env', id)
        else params.delete('env')
        params.delete('group')
        params.delete('connection')
        params.delete('access')
      }),
    setGroupId: (id) =>
      patch((params) => {
        if (id) params.set('group', id)
        else params.delete('group')
        params.delete('connection')
        params.delete('access')
      })
  }
}
