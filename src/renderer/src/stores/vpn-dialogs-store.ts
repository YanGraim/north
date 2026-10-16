import type { VpnConflict } from '@shared/types'
import { create } from 'zustand'

/** Which VPN dialog is open — UI state only, the profiles themselves live in TanStack Query. */
type VpnDialogsState = {
  wizardOpen: boolean
  /** Profile whose credentials dialog is open (e.g. after AUTH_FAILED). */
  secretsFor: string | null
  conflict: { profileId: string; conflicts: VpnConflict[] } | null
  openWizard: () => void
  closeWizard: () => void
  openSecrets: (profileId: string) => void
  closeSecrets: () => void
  openConflict: (profileId: string, conflicts: VpnConflict[]) => void
  closeConflict: () => void
}

export const useVpnDialogsStore = create<VpnDialogsState>((set) => ({
  wizardOpen: false,
  secretsFor: null,
  conflict: null,
  openWizard: () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),
  openSecrets: (profileId) => set({ secretsFor: profileId }),
  closeSecrets: () => set({ secretsFor: null }),
  openConflict: (profileId, conflicts) => set({ conflict: { profileId, conflicts } }),
  closeConflict: () => set({ conflict: null })
}))
