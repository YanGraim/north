import type { ResolvedTheme, ThemePreference } from '@shared/lib/theme'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type { ResolvedTheme, ThemePreference }

export type LocaleCode = 'pt-BR' | 'en' | 'es'
export type ListSort = 'name' | 'lastAccess'
export type MonoFontFamily =
  | 'ibm-plex-mono'
  | 'jetbrains-mono'
  | 'ui-monospace'
  | 'menlo-consolas'
  | 'courier'

/** Original default size (px); the whole app's rem-based scale is relative to this baseline. */
export const DEFAULT_MONO_FONT_SIZE = 12.5

export const MONO_FONT_FAMILY_STACKS: Record<MonoFontFamily, string> = {
  'ibm-plex-mono': '"IBM Plex Mono", "SF Mono", ui-monospace, monospace',
  'jetbrains-mono': '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
  'ui-monospace': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  'menlo-consolas': 'Menlo, Consolas, "SF Mono", monospace',
  courier: '"Courier New", Courier, monospace'
}

interface UiState {
  sidebarCollapsed: boolean
  expandedTreeNodes: Record<string, boolean>
  sidebarTagsExpanded: boolean
  sidebarOverviewExpanded: boolean
  sidebarClientsExpanded: boolean
  sidebarApisExpanded: boolean
  sidebarAgentsExpanded: boolean
  listSort: ListSort
  theme: ThemePreference
  locale: LocaleCode
  /** Local display name — empty falls back to OS username at render time. */
  displayName: string
  /** Optional e-mail shown in the sidebar chip; never validated or synced. */
  profileEmail: string
  /** One-time seed from `app:get-identity` on first launch. */
  profileSeeded: boolean
  terminalCopyOnSelect: boolean
  /** Monospace font size (px) applied app-wide: terminal, code editors (SQL/API Studio), hosts/ports/shortcuts. */
  monoFontSize: number
  /** Monospace font family applied app-wide. */
  monoFontFamily: MonoFontFamily
  /** Last app version for which the what's-new dialog was dismissed (or silently marked). */
  lastSeenWhatsNewVersion: string | null
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  isTreeNodeExpanded: (id: string) => boolean
  toggleTreeNode: (id: string) => void
  setTreeNodeExpanded: (id: string, expanded: boolean) => void
  setSidebarTagsExpanded: (expanded: boolean) => void
  setSidebarOverviewExpanded: (expanded: boolean) => void
  setSidebarClientsExpanded: (expanded: boolean) => void
  setSidebarApisExpanded: (expanded: boolean) => void
  setSidebarAgentsExpanded: (expanded: boolean) => void
  setListSort: (sort: ListSort) => void
  setTheme: (theme: ThemePreference) => void
  setLocale: (locale: LocaleCode) => void
  setDisplayName: (name: string) => void
  setProfileEmail: (email: string) => void
  seedProfileFromOs: (username: string) => void
  setTerminalCopyOnSelect: (enabled: boolean) => void
  setMonoFontSize: (size: number) => void
  setMonoFontFamily: (family: MonoFontFamily) => void
  setLastSeenWhatsNewVersion: (version: string) => void
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
    ) {
      return 'light'
    }
    return 'dark'
  }
  return preference
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      expandedTreeNodes: {},
      sidebarTagsExpanded: true,
      sidebarOverviewExpanded: true,
      sidebarClientsExpanded: true,
      sidebarApisExpanded: true,
      sidebarAgentsExpanded: true,
      listSort: 'name',
      theme: 'dark',
      locale: 'pt-BR',
      displayName: '',
      profileEmail: '',
      profileSeeded: false,
      terminalCopyOnSelect: true,
      monoFontSize: DEFAULT_MONO_FONT_SIZE,
      monoFontFamily: 'ibm-plex-mono',
      lastSeenWhatsNewVersion: null,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      isTreeNodeExpanded: (id) => Boolean(get().expandedTreeNodes[id]),
      toggleTreeNode: (id) =>
        set((state) => ({
          expandedTreeNodes: {
            ...state.expandedTreeNodes,
            [id]: !state.expandedTreeNodes[id]
          }
        })),
      setTreeNodeExpanded: (id, expanded) =>
        set((state) => ({
          expandedTreeNodes: {
            ...state.expandedTreeNodes,
            [id]: expanded
          }
        })),
      setSidebarTagsExpanded: (expanded) => set({ sidebarTagsExpanded: expanded }),
      setSidebarOverviewExpanded: (expanded) => set({ sidebarOverviewExpanded: expanded }),
      setSidebarClientsExpanded: (expanded) => set({ sidebarClientsExpanded: expanded }),
      setSidebarApisExpanded: (expanded) => set({ sidebarApisExpanded: expanded }),
      setSidebarAgentsExpanded: (expanded) => set({ sidebarAgentsExpanded: expanded }),
      setListSort: (sort) => set({ listSort: sort }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setDisplayName: (name) => set({ displayName: name }),
      setProfileEmail: (email) => set({ profileEmail: email }),
      seedProfileFromOs: (username) =>
        set((state) =>
          state.profileSeeded ? state : { displayName: username.trim(), profileSeeded: true }
        ),
      setTerminalCopyOnSelect: (enabled) => set({ terminalCopyOnSelect: enabled }),
      setMonoFontSize: (size) => set({ monoFontSize: size }),
      setMonoFontFamily: (family) => set({ monoFontFamily: family }),
      setLastSeenWhatsNewVersion: (version) => set({ lastSeenWhatsNewVersion: version })
    }),
    {
      name: 'north-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        expandedTreeNodes: state.expandedTreeNodes,
        sidebarTagsExpanded: state.sidebarTagsExpanded,
        sidebarOverviewExpanded: state.sidebarOverviewExpanded,
        sidebarClientsExpanded: state.sidebarClientsExpanded,
        sidebarApisExpanded: state.sidebarApisExpanded,
        sidebarAgentsExpanded: state.sidebarAgentsExpanded,
        listSort: state.listSort,
        theme: state.theme,
        locale: state.locale,
        displayName: state.displayName,
        profileEmail: state.profileEmail,
        profileSeeded: state.profileSeeded,
        terminalCopyOnSelect: state.terminalCopyOnSelect,
        monoFontSize: state.monoFontSize,
        monoFontFamily: state.monoFontFamily,
        lastSeenWhatsNewVersion: state.lastSeenWhatsNewVersion
      })
    }
  )
)
