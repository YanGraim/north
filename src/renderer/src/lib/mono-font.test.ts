import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en.json'
import es from '../i18n/locales/es.json'
import ptBR from '../i18n/locales/pt-BR.json'
import {
  MONO_FONT_FAMILIES,
  resolveMonoFontStack,
  sanitizeMonoFontFamily,
  sanitizeMonoLigatures
} from './mono-font'

const IBM_PLEX = '"IBM Plex Mono", "SF Mono", ui-monospace, monospace'
const CASCADIA_MONO = '"Cascadia Mono", "SF Mono", ui-monospace, monospace'
const CASCADIA_CODE = '"Cascadia Code", "SF Mono", ui-monospace, monospace'
const FIRA_CODE = '"Fira Code", "SF Mono", ui-monospace, monospace'

const FAMILY_LABELS = {
  fontFamilyUbuntuMono: 'Ubuntu Mono',
  fontFamilyFiraCode: 'Fira Code',
  fontFamilySourceCodePro: 'Source Code Pro',
  fontFamilyCascadia: 'Cascadia',
  fontFamilyHack: 'Hack',
  fontFamilyInconsolata: 'Inconsolata',
  fontFamilyRobotoMono: 'Roboto Mono',
  fontFamilySpaceMono: 'Space Mono',
  fontFamilyNotoSansMono: 'Noto Sans Mono'
} as const

describe('resolveMonoFontStack', () => {
  it('keeps the IBM Plex Mono stack whether ligatures are on or off', () => {
    expect(resolveMonoFontStack('ibm-plex-mono', false)).toBe(IBM_PLEX)
    expect(resolveMonoFontStack('ibm-plex-mono', true)).toBe(IBM_PLEX)
  })

  it('uses Cascadia Mono when ligatures are off and Cascadia Code when they are on', () => {
    expect(resolveMonoFontStack('cascadia', false)).toBe(CASCADIA_MONO)
    expect(resolveMonoFontStack('cascadia', true)).toBe(CASCADIA_CODE)
  })

  it('keeps one Fira Code stack either way', () => {
    expect(resolveMonoFontStack('fira-code', false)).toBe(FIRA_CODE)
    expect(resolveMonoFontStack('fira-code', true)).toBe(FIRA_CODE)
  })

  it('falls back to IBM Plex Mono for an unknown family', () => {
    expect(sanitizeMonoFontFamily('comic-sans')).toBe('ibm-plex-mono')
    expect(sanitizeMonoFontFamily(null)).toBe('ibm-plex-mono')
    expect(sanitizeMonoFontFamily(undefined)).toBe('ibm-plex-mono')
    expect(resolveMonoFontStack('not-a-font', true)).toBe(IBM_PLEX)
  })

  it('treats a non-boolean ligatures value as off', () => {
    expect(sanitizeMonoLigatures(undefined)).toBe(false)
    expect(sanitizeMonoLigatures('true')).toBe(false)
    expect(sanitizeMonoLigatures(1)).toBe(false)
    expect(sanitizeMonoLigatures(false)).toBe(false)
    expect(sanitizeMonoLigatures(true)).toBe(true)
    expect(resolveMonoFontStack('cascadia', 'yes')).toBe(CASCADIA_MONO)
    expect(resolveMonoFontStack('cascadia', 1)).toBe(CASCADIA_MONO)
  })
})

describe('MONO_FONT_FAMILIES', () => {
  it('keeps the original five families first, then the nine new ones', () => {
    expect(MONO_FONT_FAMILIES).toEqual([
      'ibm-plex-mono',
      'jetbrains-mono',
      'ui-monospace',
      'menlo-consolas',
      'courier',
      'ubuntu-mono',
      'fira-code',
      'source-code-pro',
      'cascadia',
      'hack',
      'inconsolata',
      'roboto-mono',
      'space-mono',
      'noto-sans-mono'
    ])
  })
})

describe('settings.editor font labels', () => {
  it('keeps font names untranslated and marks only IBM Plex Mono as the default', () => {
    for (const locale of [ptBR, en, es]) {
      const editor = locale.settings.editor
      for (const [key, name] of Object.entries(FAMILY_LABELS)) {
        expect(editor[key as keyof typeof editor]).toBe(name)
      }
      expect(editor.ligatures.length).toBeGreaterThan(0)
    }

    expect(ptBR.settings.editor.fontFamilyIbmPlexMono).toBe('IBM Plex Mono (padrão)')
    expect(en.settings.editor.fontFamilyIbmPlexMono).toBe('IBM Plex Mono (default)')
    expect(es.settings.editor.fontFamilyIbmPlexMono).toBe('IBM Plex Mono (predeterminado)')
    expect(ptBR.settings.editor.ligatures).toBe('Ligaduras')
    expect(en.settings.editor.ligatures).toBe('Ligatures')
    expect(es.settings.editor.ligatures).toBe('Ligaduras')
  })
})
