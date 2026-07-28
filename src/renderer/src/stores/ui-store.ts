import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'dark' | 'light' | 'system'
export type LocaleCode = 'pt-BR' | 'en' | 'es'
export type ResolvedTheme = 'dark' | 'light'
export type ListSort = 'name' | 'lastAccess'

interface UiState {
  sidebarCollapsed: boolean
  expandedTreeNodes: Record<string, boolean>
  listSort: ListSort
  theme: ThemePreference
  locale: LocaleCode
  terminalCopyOnSelect: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  isTreeNodeExpanded: (id: string) => boolean
  toggleTreeNode: (id: string) => void
  setTreeNodeExpanded: (id: string, expanded: boolean) => void
  setListSort: (sort: ListSort) => void
  setTheme: (theme: ThemePreference) => void
  setLocale: (locale: LocaleCode) => void
  setTerminalCopyOnSelect: (enabled: boolean) => void
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
      listSort: 'name',
      theme: 'dark',
      locale: 'pt-BR',
      terminalCopyOnSelect: true,
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
      setListSort: (sort) => set({ listSort: sort }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setTerminalCopyOnSelect: (enabled) => set({ terminalCopyOnSelect: enabled })
    }),
    {
      name: 'north-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        expandedTreeNodes: state.expandedTreeNodes,
        listSort: state.listSort,
        theme: state.theme,
        locale: state.locale,
        terminalCopyOnSelect: state.terminalCopyOnSelect
      })
    }
  )
)
