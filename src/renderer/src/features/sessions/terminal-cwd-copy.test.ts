import { describe, expect, it } from 'vitest'
import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'
import ptBR from '../../i18n/locales/pt-BR.json'
import { acceptDirectoryEntries } from './terminal-cwd-list'

const copy = {
  'pt-BR': {
    badge: 'Arquivos',
    waiting:
      'A pasta do terminal ainda não chegou. O North lê o prompt do bash e do zsh desta sessão e não mostra o diretório de login no lugar.',
    listFailed: 'Não foi possível listar esta pasta.',
    pendingCd: 'O terminal está ocupado. A pasta muda quando o prompt estiver livre.',
    pathRejected: 'Este caminho não pode ir para o shell.',
    mutateFailed: 'Não foi possível alterar esta pasta.',
    upload: 'Enviar'
  },
  en: {
    badge: 'Files',
    waiting:
      "The terminal folder has not arrived yet. North reads this session's bash and zsh prompt and does not show the login directory instead.",
    listFailed: 'Could not list this folder.',
    pendingCd: 'The terminal is busy. The folder changes when the prompt is free.',
    pathRejected: 'This path cannot go to the shell.',
    mutateFailed: 'Could not change this folder.',
    upload: 'Upload'
  },
  es: {
    badge: 'Archivos',
    waiting:
      'La carpeta del terminal todavía no llegó. North lee el prompt de bash y zsh de esta sesión y no muestra el directorio de login en su lugar.',
    listFailed: 'No se pudo listar esta carpeta.',
    pendingCd: 'El terminal está ocupado. La carpeta cambia cuando el prompt esté libre.',
    pathRejected: 'Esta ruta no puede ir al shell.',
    mutateFailed: 'No se pudo modificar esta carpeta.',
    upload: 'Enviar'
  }
} as const

describe('terminal cwd copy', () => {
  it('uses the spec strings in pt-BR, en, and es', () => {
    expect(ptBR.connection.terminalCwd).toEqual(copy['pt-BR'])
    expect(en.connection.terminalCwd).toEqual(copy.en)
    expect(es.connection.terminalCwd).toEqual(copy.es)
  })
})

describe('acceptDirectoryEntries', () => {
  it('discards a list whose path is no longer the cwd', () => {
    expect(() =>
      acceptDirectoryEntries('/var', '/var/log', {
        ok: true,
        entries: []
      })
    ).toThrowError(/stale/i)
  })

  it('returns entries only for the current path', () => {
    const entries = [
      {
        name: 'wtmp',
        path: '/var/log/wtmp',
        type: 'file' as const,
        size: 1,
        modifiedAt: null,
        permissions: 'rw-r--r--',
        owner: 'root',
        group: 'adm'
      }
    ]
    expect(acceptDirectoryEntries('/var/log', '/var/log', { ok: true, entries })).toEqual(entries)
  })

  it('hides the transport error behind a list failure', () => {
    expect(() =>
      acceptDirectoryEntries('/var', '/var', { ok: false, reason: 'unavailable' })
    ).toThrowError(/list-failed/)
    expect(() => acceptDirectoryEntries('/var', '/var', { ok: false, reason: 'missing' })).toThrow(
      expect.objectContaining({ name: 'DirectoryListFailedError' })
    )
  })
})
