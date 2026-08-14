import { create } from 'zustand'

type WhatsNewState = {
  open: boolean
  /** When true, show notes even if lastSeen already matches (Settings / palette). */
  forced: boolean
  openWhatsNew: (options?: { force?: boolean }) => void
  closeWhatsNew: () => void
}

export const useWhatsNewStore = create<WhatsNewState>((set) => ({
  open: false,
  forced: false,
  openWhatsNew: (options) => set({ open: true, forced: Boolean(options?.force) }),
  closeWhatsNew: () => set({ open: false, forced: false })
}))
