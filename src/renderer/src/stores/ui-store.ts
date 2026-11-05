import {
  isThemePreference,
  type ResolvedTheme,
  resolveAutomaticTheme,
  type ThemePreference
} from '@shared/lib/theme'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type AppFontFamily, DEFAULT_APP_FONT_FAMILY, sanitizeAppFontFamily } from '../lib/app-font'
import {
  rememberFavoriteColor as rememberFavorite,
  sanitizeFavoriteColors,
  removeFavoriteColor as withoutFavorite
} from '../lib/favorite-colors'
import {
  DEFAULT_MONO_FONT_FAMILY,
  type MonoFontFamily,
  sanitizeMonoFontFamily,
  sanitizeMonoLigatures
} from '../lib/mono-font'

export type { AppFontFamily } from '../lib/app-font'
export type { MonoFontFamily } from '../lib/mono-font'
export type { ResolvedTheme, ThemePreference }

export type LocaleCode = 'pt-BR' | 'en' | 'es'
export type ListSort = 'name' | 'lastAccess'

/** Original default size (px); the whole app's rem-based scale is relative to this baseline. */
export const DEFAULT_MONO_FONT_SIZE = 12.5

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
  /** Bumped when automatic mode crosses 08:00 or 17:00. Not persisted. */
  automaticThemeTick: number
  locale: LocaleCode
  /** Local display name — empty falls back to OS username at render time. */
  displayName: string
  /** Optional e-mail shown in the sidebar chip; never validated or synced. */
  profileEmail: string
  /** One-time seed from `app:get-identity` on first launch. */
  profileSeeded: boolean
  terminalCopyOnSelect: boolean
  /** Right button copies or pastes; the middle button opens the menu. Off keeps the middle button. */
  terminalRightButtonCopies: boolean
  /** Scales the root and sets the terminal font size (px). */
  monoFontSize: number
  /** Family for the window, menus, forms, and tables. Default Inter. */
  appFontFamily: AppFontFamily
  /** Monospace family for the terminal, code editors, log panel, hosts, ports, and shortcuts. */
  monoFontFamily: MonoFontFamily
  /** Join sequences such as `=>` on monospace surfaces. Off until the user turns it on. */
  monoLigatures: boolean
  /** Last app version for which the what's-new dialog was dismissed (or silently marked). */
  lastSeenWhatsNewVersion: string | null
  /** Workspace that legacy (unscoped) routes and app launch land on — ADR 0018. */
  lastWorkspaceId: string | null
  /** Left (local) pane of the file browser reopens where it was last left. */
  fileBrowserLocalPath: string | null
  /** Free colors shown in every color picker on this computer. */
  favoriteColors: string[]
  setFileBrowserLocalPath: (path: string) => void
  rememberFavoriteColor: (color: string) => void
  removeFavoriteColor: (color: string) => void
  setLastWorkspaceId: (id: string) => void
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
  bumpAutomaticTheme: () => void
  setLocale: (locale: LocaleCode) => void
  setDisplayName: (name: string) => void
  setProfileEmail: (email: string) => void
  seedProfileFromOs: (username: string) => void
  setTerminalCopyOnSelect: (enabled: boolean) => void
  setTerminalRightButtonCopies: (enabled: boolean) => void
  setMonoFontSize: (size: number) => void
  setAppFontFamily: (family: AppFontFamily) => void
  setMonoFontFamily: (family: MonoFontFamily) => void
  setMonoLigatures: (enabled: boolean) => void
  setLastSeenWhatsNewVersion: (version: string) => void
}

export function resolveTheme(preference: ThemePreference, now: Date = new Date()): ResolvedTheme {
  if (preference === 'system') {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
    ) {
      return 'light'
    }
    return 'dark'
  }
  if (preference === 'automatic') return resolveAutomaticTheme(now)
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
      automaticThemeTick: 0,
      locale: 'pt-BR',
      displayName: '',
      profileEmail: '',
      profileSeeded: false,
      terminalCopyOnSelect: true,
      terminalRightButtonCopies: false,
      monoFontSize: DEFAULT_MONO_FONT_SIZE,
      appFontFamily: DEFAULT_APP_FONT_FAMILY,
      monoFontFamily: DEFAULT_MONO_FONT_FAMILY,
      monoLigatures: false,
      lastSeenWhatsNewVersion: null,
      lastWorkspaceId: null,
      fileBrowserLocalPath: null,
      favoriteColors: [],
      setFileBrowserLocalPath: (path) => set({ fileBrowserLocalPath: path }),
      rememberFavoriteColor: (color) =>
        set((state) => {
          const next = rememberFavorite(state.favoriteColors, color)
          if (next === state.favoriteColors) return state
          return { favoriteColors: next }
        }),
      removeFavoriteColor: (color) =>
        set((state) => {
          const next = withoutFavorite(state.favoriteColors, color)
          if (next === state.favoriteColors) return state
          return { favoriteColors: next }
        }),
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
      setTheme: (theme) => {
        if (!isThemePreference(theme)) return
        set({ theme })
      },
      bumpAutomaticTheme: () =>
        set((state) => ({ automaticThemeTick: state.automaticThemeTick + 1 })),
      setLocale: (locale) => set({ locale }),
      setDisplayName: (name) => set({ displayName: name }),
      setProfileEmail: (email) => set({ profileEmail: email }),
      seedProfileFromOs: (username) =>
        set((state) =>
          state.profileSeeded ? state : { displayName: username.trim(), profileSeeded: true }
        ),
      setTerminalCopyOnSelect: (enabled) => set({ terminalCopyOnSelect: enabled }),
      setTerminalRightButtonCopies: (enabled) => set({ terminalRightButtonCopies: enabled }),
      setMonoFontSize: (size) => set({ monoFontSize: size }),
      setAppFontFamily: (family) => set({ appFontFamily: sanitizeAppFontFamily(family) }),
      setMonoFontFamily: (family) => set({ monoFontFamily: sanitizeMonoFontFamily(family) }),
      setMonoLigatures: (enabled) => set({ monoLigatures: sanitizeMonoLigatures(enabled) }),
      setLastSeenWhatsNewVersion: (version) => set({ lastSeenWhatsNewVersion: version }),
      setLastWorkspaceId: (id) => set({ lastWorkspaceId: id })
    }),
    {
      name: 'north-ui',
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') return currentState
        const persisted = persistedState as Partial<UiState>
        return {
          ...currentState,
          ...persisted,
          theme: isThemePreference(persisted.theme) ? persisted.theme : 'dark',
          automaticThemeTick: 0,
          favoriteColors: sanitizeFavoriteColors(persisted.favoriteColors),
          appFontFamily: sanitizeAppFontFamily(persisted.appFontFamily),
          monoFontFamily: sanitizeMonoFontFamily(persisted.monoFontFamily),
          monoLigatures: sanitizeMonoLigatures(persisted.monoLigatures),
          terminalRightButtonCopies: persisted.terminalRightButtonCopies === true
        }
      },
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
        terminalRightButtonCopies: state.terminalRightButtonCopies,
        monoFontSize: state.monoFontSize,
        appFontFamily: state.appFontFamily,
        monoFontFamily: state.monoFontFamily,
        monoLigatures: state.monoLigatures,
        lastSeenWhatsNewVersion: state.lastSeenWhatsNewVersion,
        lastWorkspaceId: state.lastWorkspaceId,
        fileBrowserLocalPath: state.fileBrowserLocalPath,
        favoriteColors: sanitizeFavoriteColors(state.favoriteColors)
      })
    }
  )
)
