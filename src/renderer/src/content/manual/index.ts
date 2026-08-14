import type { LocaleCode } from '@renderer/stores/ui-store'

import accessesEn from './en/accesses.md?raw'
import commandPaletteEn from './en/command-palette.md?raw'
import connectEn from './en/connect.md?raw'
import databaseEn from './en/database.md?raw'
import gettingStartedEn from './en/getting-started.md?raw'
import importExportEn from './en/import-export.md?raw'
import organizationEn from './en/organization.md?raw'
import overviewEn from './en/overview.md?raw'
import securityEn from './en/security.md?raw'
import workflowsEn from './en/workflows.md?raw'

import accessesEs from './es/accesses.md?raw'
import commandPaletteEs from './es/command-palette.md?raw'
import connectEs from './es/connect.md?raw'
import databaseEs from './es/database.md?raw'
import gettingStartedEs from './es/getting-started.md?raw'
import importExportEs from './es/import-export.md?raw'
import organizationEs from './es/organization.md?raw'
import overviewEs from './es/overview.md?raw'
import securityEs from './es/security.md?raw'
import workflowsEs from './es/workflows.md?raw'

import accessesPt from './pt-BR/accesses.md?raw'
import commandPalettePt from './pt-BR/command-palette.md?raw'
import connectPt from './pt-BR/connect.md?raw'
import databasePt from './pt-BR/database.md?raw'
import gettingStartedPt from './pt-BR/getting-started.md?raw'
import importExportPt from './pt-BR/import-export.md?raw'
import organizationPt from './pt-BR/organization.md?raw'
import overviewPt from './pt-BR/overview.md?raw'
import securityPt from './pt-BR/security.md?raw'
import workflowsPt from './pt-BR/workflows.md?raw'

export const MANUAL_CHAPTER_IDS = [
  'overview',
  'organization',
  'getting-started',
  'connect',
  'accesses',
  'database',
  'workflows',
  'command-palette',
  'import-export',
  'security'
] as const

export type ManualChapterId = (typeof MANUAL_CHAPTER_IDS)[number]

export type ManualChapter = {
  id: ManualChapterId
  order: number
  titleKey: `help.chapters.${ManualChapterId}`
  body: string
}

const BODIES: Record<LocaleCode, Record<ManualChapterId, string>> = {
  'pt-BR': {
    overview: overviewPt,
    organization: organizationPt,
    'getting-started': gettingStartedPt,
    connect: connectPt,
    accesses: accessesPt,
    database: databasePt,
    workflows: workflowsPt,
    'command-palette': commandPalettePt,
    'import-export': importExportPt,
    security: securityPt
  },
  en: {
    overview: overviewEn,
    organization: organizationEn,
    'getting-started': gettingStartedEn,
    connect: connectEn,
    accesses: accessesEn,
    database: databaseEn,
    workflows: workflowsEn,
    'command-palette': commandPaletteEn,
    'import-export': importExportEn,
    security: securityEn
  },
  es: {
    overview: overviewEs,
    organization: organizationEs,
    'getting-started': gettingStartedEs,
    connect: connectEs,
    accesses: accessesEs,
    database: databaseEs,
    workflows: workflowsEs,
    'command-palette': commandPaletteEs,
    'import-export': importExportEs,
    security: securityEs
  }
}

export function isManualChapterId(value: string): value is ManualChapterId {
  return (MANUAL_CHAPTER_IDS as readonly string[]).includes(value)
}

export function getManualChapters(locale: LocaleCode): ManualChapter[] {
  const bodies = BODIES[locale] ?? BODIES['pt-BR']
  return MANUAL_CHAPTER_IDS.map((id, index) => ({
    id,
    order: index,
    titleKey: `help.chapters.${id}`,
    body: bodies[id]
  }))
}

export function getManualChapter(
  locale: LocaleCode,
  id: ManualChapterId
): ManualChapter | undefined {
  return getManualChapters(locale).find((chapter) => chapter.id === id)
}
