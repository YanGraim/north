import type { AccessType } from '@shared/types'
import { create } from 'zustand'

export type InventoryDialog =
  | { type: 'client'; mode: 'create' }
  | { type: 'client'; mode: 'edit'; id: string }
  | { type: 'environment'; mode: 'create'; clientId: string }
  | { type: 'environment'; mode: 'edit'; id: string }
  | { type: 'group'; mode: 'create'; environmentId: string }
  | { type: 'group'; mode: 'edit'; id: string }
  | { type: 'tag'; mode: 'create' }
  | { type: 'tag'; mode: 'edit'; id: string }
  | {
      type: 'connection'
      mode: 'create'
      groupId?: string
      environmentId?: string
      clientId?: string
    }
  | { type: 'connection'; mode: 'edit'; id: string }
  | {
      type: 'access'
      mode: 'create'
      groupId?: string
      environmentId?: string
      clientId?: string
      accessType?: AccessType
    }
  | { type: 'access'; mode: 'edit'; id: string }
  | null

interface InventoryDialogsState {
  dialog: InventoryDialog
  open: (dialog: Exclude<InventoryDialog, null>) => void
  close: () => void
}

/**
 * Radix DropdownMenu/ContextMenu set `pointer-events: none` on body.
 * Opening a Dialog in the same tick leaves the modal with pointer-events
 * disabled (clicks pass through to the overlay). Defer + clear the style.
 */
function releaseBodyPointerEvents(): void {
  if (typeof document === 'undefined') return
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.removeProperty('pointer-events')
  }
}

export const useInventoryDialogsStore = create<InventoryDialogsState>((set) => ({
  dialog: null,
  open: (dialog) => {
    window.setTimeout(() => {
      releaseBodyPointerEvents()
      set({ dialog })
    }, 0)
  },
  close: () => {
    set({ dialog: null })
    window.setTimeout(releaseBodyPointerEvents, 0)
  }
}))
