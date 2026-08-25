import type { ManualChapterId } from '@renderer/content/manual'
import type { LocaleCode } from '@renderer/stores/ui-store'
import { isNewerVersion } from '@shared/lib/semver'
import notes013En from './0.1.13/en.md?raw'
import notes013Es from './0.1.13/es.md?raw'
import notes013Pt from './0.1.13/pt-BR.md?raw'
import notes014En from './0.1.14/en.md?raw'
import notes014Es from './0.1.14/es.md?raw'
import notes014Pt from './0.1.14/pt-BR.md?raw'
import notes015En from './0.1.15/en.md?raw'
import notes015Es from './0.1.15/es.md?raw'
import notes015Pt from './0.1.15/pt-BR.md?raw'
import notes016En from './0.1.16/en.md?raw'
import notes016Es from './0.1.16/es.md?raw'
import notes016Pt from './0.1.16/pt-BR.md?raw'
import notes017En from './0.1.17/en.md?raw'
import notes017Es from './0.1.17/es.md?raw'
import notes017Pt from './0.1.17/pt-BR.md?raw'
import notes018En from './0.1.18/en.md?raw'
import notes018Es from './0.1.18/es.md?raw'
import notes018Pt from './0.1.18/pt-BR.md?raw'
import { filterWhatsNewEntries } from './filter'

export type WhatsNewEntry = {
  version: string
  /** Optional deep-link into the in-app manual */
  chapter?: ManualChapterId
  bodies: Record<LocaleCode, string>
}

/** Newest last — order used when accumulating skipped versions. */
export const WHATS_NEW_ENTRIES: readonly WhatsNewEntry[] = [
  {
    version: '0.1.13',
    chapter: 'workflows',
    bodies: {
      'pt-BR': notes013Pt,
      en: notes013En,
      es: notes013Es
    }
  },
  {
    version: '0.1.14',
    chapter: 'connect',
    bodies: {
      'pt-BR': notes014Pt,
      en: notes014En,
      es: notes014Es
    }
  },
  {
    version: '0.1.15',
    chapter: 'database',
    bodies: {
      'pt-BR': notes015Pt,
      en: notes015En,
      es: notes015Es
    }
  },
  {
    version: '0.1.16',
    chapter: 'organization',
    bodies: {
      'pt-BR': notes016Pt,
      en: notes016En,
      es: notes016Es
    }
  },
  {
    version: '0.1.17',
    chapter: 'database',
    bodies: {
      'pt-BR': notes017Pt,
      en: notes017En,
      es: notes017Es
    }
  },
  {
    version: '0.1.18',
    chapter: 'workflows',
    bodies: {
      'pt-BR': notes018Pt,
      en: notes018En,
      es: notes018Es
    }
  }
]

/**
 * Entries strictly newer than `afterVersion` and up to `currentVersion` (inclusive).
 * If `afterVersion` is null/undefined, returns nothing (first boot should not show notes).
 */
export function getWhatsNewSince(
  afterVersion: string | null | undefined,
  currentVersion: string
): WhatsNewEntry[] {
  return filterWhatsNewEntries(WHATS_NEW_ENTRIES, afterVersion, currentVersion)
}

/** All notes for versions up to `currentVersion` (Settings / palette reopen). */
export function getWhatsNewUpTo(currentVersion: string): WhatsNewEntry[] {
  return WHATS_NEW_ENTRIES.filter((entry) => !isNewerVersion(entry.version, currentVersion))
}

export function getWhatsNewBody(entry: WhatsNewEntry, locale: LocaleCode): string {
  return entry.bodies[locale] ?? entry.bodies['pt-BR']
}

export function hasWhatsNewSince(
  afterVersion: string | null | undefined,
  currentVersion: string
): boolean {
  return getWhatsNewSince(afterVersion, currentVersion).length > 0
}
