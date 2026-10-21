import type { CopyItemKind } from '@shared/types'
import { create } from 'zustand'

/** What "Copiar para workspace…" was opened on (one dialog for the whole app). */
export type CopySubject = {
  kind: CopyItemKind
  id: string
  name: string
}

type CopyToWorkspaceState = {
  subject: CopySubject | null
  open: (subject: CopySubject) => void
  close: () => void
}

export const useCopyToWorkspaceStore = create<CopyToWorkspaceState>((set) => ({
  subject: null,
  open: (subject) => set({ subject }),
  close: () => set({ subject: null })
}))
