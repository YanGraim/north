import { toastSuccess, toastWarning } from '@renderer/lib/toast'
import type { FsEditOpenReason } from '@shared/lib/remote-edit'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const externalEditorsQueryKey = ['settings', 'external-editors'] as const

export type RemoteEditTab = {
  editId: string
  remotePath: string
  content: string
  savedContent: string
  saving: boolean
}

function openFailure(t: (key: string) => string, reason: FsEditOpenReason): string {
  if (reason === 'binary' || reason === 'not-file') return t('connection.fileBrowser.binary')
  if (reason === 'too-large') return t('connection.fileBrowser.tooLarge')
  return t('connection.fileBrowser.editorFailed')
}

export function useRemoteEdits(sessionId: string): {
  editors: { id: string; name: string }[]
  tabs: RemoteEditTab[]
  activeId: string | null
  openInternal: (remotePath: string) => Promise<void>
  openExternal: (remotePath: string, editorId: string) => Promise<void>
  setActive: (editId: string) => void
  updateContent: (editId: string, content: string) => void
  save: (editId: string) => Promise<void>
  close: (editId: string) => Promise<void>
} {
  const { t } = useTranslation()
  const [tabs, setTabs] = useState<RemoteEditTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const editorsQuery = useQuery({
    queryKey: externalEditorsQueryKey,
    queryFn: () => window.north.listExternalEditors()
  })

  useEffect(() => {
    return window.north.fs.onEditUploaded((notice) => {
      if (notice.sessionId !== sessionId) return
      toastSuccess(t('connection.fileBrowser.sent'))
    })
  }, [sessionId, t])

  useEffect(() => {
    return window.north.fs.onEditFailed((notice) => {
      if (notice.sessionId !== sessionId) return
      toastWarning(t('connection.fileBrowser.sendFailed'))
    })
  }, [sessionId, t])

  useEffect(() => {
    return () => {
      for (const tab of tabsRef.current) {
        void window.north.fs.editClose({ sessionId, editId: tab.editId })
      }
    }
  }, [sessionId])

  async function openInternal(remotePath: string): Promise<void> {
    const existing = tabsRef.current.find((tab) => tab.remotePath === remotePath)
    if (existing) {
      setActiveId(existing.editId)
      return
    }
    try {
      const result = await window.north.fs.editOpen({
        sessionId,
        remotePath,
        editorId: 'internal'
      })
      if (!result.ok) {
        toastWarning(openFailure(t, result.reason))
        return
      }
      const content = result.content ?? ''
      setTabs((current) => [
        ...current,
        {
          editId: result.editId,
          remotePath: result.remotePath,
          content,
          savedContent: content,
          saving: false
        }
      ])
      setActiveId(result.editId)
    } catch {
      toastWarning(t('connection.fileBrowser.editorFailed'))
    }
  }

  async function openExternal(remotePath: string, editorId: string): Promise<void> {
    try {
      const result = await window.north.fs.editOpen({ sessionId, remotePath, editorId })
      if (!result.ok) toastWarning(openFailure(t, result.reason))
    } catch {
      toastWarning(t('connection.fileBrowser.editorFailed'))
    }
  }

  function updateContent(editId: string, content: string): void {
    setTabs((current) => current.map((tab) => (tab.editId === editId ? { ...tab, content } : tab)))
  }

  async function save(editId: string): Promise<void> {
    const tab = tabsRef.current.find((item) => item.editId === editId)
    if (!tab || tab.saving || tab.content === tab.savedContent) return
    setTabs((current) =>
      current.map((item) => (item.editId === editId ? { ...item, saving: true } : item))
    )
    try {
      const result = await window.north.fs.editSave({
        sessionId,
        editId,
        content: tab.content
      })
      if (!result.ok) {
        toastWarning(t('connection.fileBrowser.sendFailed'))
        setTabs((current) =>
          current.map((item) => (item.editId === editId ? { ...item, saving: false } : item))
        )
        return
      }
      setTabs((current) =>
        current.map((item) =>
          item.editId === editId ? { ...item, saving: false, savedContent: tab.content } : item
        )
      )
    } catch {
      toastWarning(t('connection.fileBrowser.sendFailed'))
      setTabs((current) =>
        current.map((item) => (item.editId === editId ? { ...item, saving: false } : item))
      )
    }
  }

  async function close(editId: string): Promise<void> {
    setTabs((current) => {
      const next = current.filter((tab) => tab.editId !== editId)
      setActiveId((active) => {
        if (active !== editId) return active
        return next[0]?.editId ?? null
      })
      return next
    })
    try {
      await window.north.fs.editClose({ sessionId, editId })
    } catch {
      // The session close path also deletes the temp file.
    }
  }

  return {
    editors: (editorsQuery.data?.editors ?? []).map((editor) => ({
      id: editor.id,
      name: editor.name
    })),
    tabs,
    activeId,
    openInternal,
    openExternal,
    setActive: setActiveId,
    updateContent,
    save,
    close
  }
}
