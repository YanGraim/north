import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en.json'
import es from '../i18n/locales/es.json'
import ptBR from '../i18n/locales/pt-BR.json'
import { APP_FONT_FAMILIES, resolveAppFontStack, sanitizeAppFontFamily } from './app-font'
import { resolveMonoFontStack } from './mono-font'

const INTER = '"Inter", "Segoe UI", sans-serif'
const SEGOE = '"Segoe UI", sans-serif'
const SYSTEM = 'ui-sans-serif, "SF Pro", "Segoe UI", system-ui, sans-serif'

const FAMILY_LABELS = {
  fontFamilySegoeUi: 'Segoe UI',
  fontFamilyRoboto: 'Roboto',
  fontFamilyOpenSans: 'Open Sans',
  fontFamilyOutfit: 'Outfit',
  fontFamilyMontserrat: 'Montserrat',
  fontFamilyUbuntu: 'Ubuntu'
} as const

describe('resolveAppFontStack', () => {
  it('uses Inter, with a Segoe UI fallback, as the default', () => {
    expect(resolveAppFontStack('inter')).toBe(INTER)
    expect(resolveAppFontStack(undefined)).toBe(INTER)
  })

  it('keeps Segoe UI as a system face and does not bundle a second name in front', () => {
    expect(resolveAppFontStack('segoe-ui')).toBe(SEGOE)
    expect(resolveAppFontStack('segoe-ui')).not.toContain('Inter')
  })

  it('resolves the system default to the platform sans, including SF Pro and Segoe UI', () => {
    expect(resolveAppFontStack('system')).toBe(SYSTEM)
    expect(resolveAppFontStack('system')).not.toContain('Inter')
  })

  it('reuses the terminal stack for JetBrains Mono and Fira Code', () => {
    expect(resolveAppFontStack('jetbrains-mono')).toBe(
      resolveMonoFontStack('jetbrains-mono', false)
    )
    expect(resolveAppFontStack('fira-code')).toBe(resolveMonoFontStack('fira-code', true))
  })

  it('falls back to Inter for an unknown family', () => {
    expect(sanitizeAppFontFamily('comic-sans')).toBe('inter')
    expect(sanitizeAppFontFamily(null)).toBe('inter')
    expect(sanitizeAppFontFamily(undefined)).toBe('inter')
    expect(resolveAppFontStack('not-a-font')).toBe(INTER)
  })
})

describe('APP_FONT_FAMILIES', () => {
  it('lists the ten families in the order of the selector', () => {
    expect(APP_FONT_FAMILIES).toEqual([
      'inter',
      'segoe-ui',
      'roboto',
      'open-sans',
      'outfit',
      'montserrat',
      'ubuntu',
      'system',
      'jetbrains-mono',
      'fira-code'
    ])
  })
})

describe('settings.editor app font labels', () => {
  it('keeps family names untranslated, marks only Inter as the default, and separates Ubuntu from Ubuntu Mono', () => {
    for (const locale of [ptBR, en, es]) {
      const editor = locale.settings.editor
      for (const [key, name] of Object.entries(FAMILY_LABELS)) {
        expect(editor[key as keyof typeof editor]).toBe(name)
      }
      expect(editor.fontFamilyUbuntu).not.toBe(editor.fontFamilyUbuntuMono)
    }

    expect(ptBR.settings.editor.fontFamilyInter).toBe('Inter (padrão)')
    expect(en.settings.editor.fontFamilyInter).toBe('Inter (default)')
    expect(es.settings.editor.fontFamilyInter).toBe('Inter (predeterminado)')
    expect(ptBR.settings.editor.fontFamilySystem).toBe('Padrão do sistema')
    expect(en.settings.editor.fontFamilySystem).toBe('System default')
    expect(es.settings.editor.fontFamilySystem).toBe('Predeterminada del sistema')
  })
})
