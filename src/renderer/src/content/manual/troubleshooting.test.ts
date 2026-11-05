import { isGuidanceMarker, nodeText } from '@renderer/features/help/manual-markdown'
import en from '@renderer/i18n/locales/en.json'
import es from '@renderer/i18n/locales/es.json'
import ptBR from '@renderer/i18n/locales/pt-BR.json'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { getManualChapters, MANUAL_CHAPTER_IDS } from './index'

const LOCALES = ['pt-BR', 'en', 'es'] as const

const GIT_CONFIG = [
  'git config --global http.version HTTP/1.1',
  'git config --global http.extraHeader "Expect:"'
] as const

describe('troubleshooting chapter', () => {
  it('is listed after vpns', () => {
    expect(MANUAL_CHAPTER_IDS.at(-2)).toBe('vpns')
    expect(MANUAL_CHAPTER_IDS.at(-1)).toBe('troubleshooting')
  })

  it('carries the guidance marker, the git config lines and the VPN cross-link', () => {
    for (const locale of LOCALES) {
      const chapters = getManualChapters(locale)
      const body = (
        chapters.find((chapter) => chapter.id === 'troubleshooting')?.body ?? ''
      ).replaceAll('\r\n', '\n')
      const vpns = chapters.find((chapter) => chapter.id === 'vpns')?.body ?? ''
      expect(body).toContain('\n> guidance\n')
      for (const line of GIT_CONFIG) expect(body).toContain(line)
      expect(body).toContain('HTTP/1.1')
      expect(body).toContain('100 Continue')
      expect(body).toContain('1024')
      expect(vpns).toContain('](troubleshooting)')
    }
  })

  it('titles and the notice copy match the three locales', () => {
    expect(ptBR.help.chapters.troubleshooting).toBe('Problemas conhecidos')
    expect(en.help.chapters.troubleshooting).toBe('Known issues')
    expect(es.help.chapters.troubleshooting).toBe('Problemas conocidos')
    expect(ptBR.help.knownIssues.noticeTitle).toBe('Só orientação')
    expect(en.help.knownIssues.noticeTitle).toBe('Guidance only')
    expect(es.help.knownIssues.noticeTitle).toBe('Solo orientación')
    expect(ptBR.help.knownIssues.noticeBody).toContain('não aplica esta correção')
    expect(en.help.knownIssues.noticeBody).toContain('does not apply this fix')
    expect(es.help.knownIssues.noticeBody).toContain('no aplica esta corrección')
  })
})

describe('isGuidanceMarker', () => {
  it('matches only the exact token, including text inside a paragraph node', () => {
    expect(isGuidanceMarker('guidance')).toBe(true)
    expect(isGuidanceMarker('  guidance\n')).toBe(true)
    expect(isGuidanceMarker('guidance only')).toBe(false)
    expect(isGuidanceMarker('')).toBe(false)
    const marker = createElement('p', null, 'guidance')
    const quote = createElement('p', null, 'a real quote')
    expect(isGuidanceMarker(nodeText(['\n', marker, '\n']))).toBe(true)
    expect(isGuidanceMarker(nodeText(quote))).toBe(false)
  })
})
