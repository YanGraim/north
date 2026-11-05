import { describe, expect, it } from 'vitest'
import {
  classifyRemoteEdit,
  type ExternalEditor,
  planExternalEditorSpawn,
  REMOTE_EDIT_MAX_BYTES,
  REMOTE_EDIT_SAMPLE_BYTES,
  validateExternalEditorList
} from './remote-edit'

const EDITOR_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

function editor(overrides: Partial<ExternalEditor> = {}): ExternalEditor {
  return {
    id: EDITOR_ID,
    name: 'Neovim',
    executable: '/usr/bin/nvim',
    ...overrides
  }
}

describe('classifyRemoteEdit', () => {
  it('treats an empty file as text', () => {
    expect(classifyRemoteEdit(0, new Uint8Array())).toBe('text')
  })

  it('treats a text prefix as text', () => {
    expect(classifyRemoteEdit(5, new TextEncoder().encode('hello'))).toBe('text')
  })

  it('treats a NUL in the sample as binary', () => {
    const sample = new Uint8Array([0x68, 0x00, 0x69])
    expect(classifyRemoteEdit(3, sample)).toBe('binary')
  })

  it('ignores a NUL past the first 8 KiB', () => {
    const sample = new Uint8Array(REMOTE_EDIT_SAMPLE_BYTES + 1).fill(0x61)
    sample[REMOTE_EDIT_SAMPLE_BYTES] = 0
    expect(classifyRemoteEdit(sample.length, sample)).toBe('text')
  })

  it('refuses a file larger than 8 MiB', () => {
    expect(classifyRemoteEdit(REMOTE_EDIT_MAX_BYTES, new Uint8Array())).toBe('text')
    expect(classifyRemoteEdit(REMOTE_EDIT_MAX_BYTES + 1, new Uint8Array([0x61]))).toBe('too-large')
  })

  it('refuses a size that is not a file length', () => {
    expect(classifyRemoteEdit(-1, new Uint8Array())).toBe('binary')
    expect(classifyRemoteEdit(Number.NaN, new Uint8Array())).toBe('binary')
  })
})

describe('planExternalEditorSpawn', () => {
  it('spawns the executable with only the temp path and without a shell', () => {
    const plan = planExternalEditorSpawn({
      executable: '/usr/bin/nvim',
      tempPath: '/tmp/north-remote-edits/session/edit/hosts',
      remotePath: '/etc/hosts'
    })
    expect(plan).toEqual({
      command: '/usr/bin/nvim',
      args: ['/tmp/north-remote-edits/session/edit/hosts'],
      shell: false
    })
    expect(plan?.args).not.toContain('/etc/hosts')
    expect(plan?.args).toHaveLength(1)
  })

  it('accepts a Windows executable path', () => {
    const plan = planExternalEditorSpawn({
      executable: 'C:\\Windows\\notepad.exe',
      tempPath: 'C:\\Users\\north\\AppData\\Local\\Temp\\north\\app.conf',
      remotePath: '/etc/app.conf'
    })
    expect(plan?.command).toBe('C:\\Windows\\notepad.exe')
    expect(plan?.shell).toBe(false)
    expect(plan?.args).toEqual(['C:\\Users\\north\\AppData\\Local\\Temp\\north\\app.conf'])
  })

  it('refuses a relative executable', () => {
    expect(
      planExternalEditorSpawn({
        executable: 'notepad.exe',
        tempPath: '/tmp/north/app.conf',
        remotePath: '/etc/app.conf'
      })
    ).toBeNull()
  })

  it('refuses to use the remote path as the temp file', () => {
    expect(
      planExternalEditorSpawn({
        executable: '/usr/bin/nvim',
        tempPath: '/etc/hosts',
        remotePath: '/etc/hosts'
      })
    ).toBeNull()
  })
})

describe('validateExternalEditorList', () => {
  it('accepts a unique absolute executable', () => {
    expect(validateExternalEditorList([editor()])).toBe('ok')
    expect(validateExternalEditorList([])).toBe('ok')
  })

  it('refuses a duplicate name, a duplicate id, and a relative path', () => {
    expect(
      validateExternalEditorList([editor(), editor({ id: OTHER_ID, executable: '/usr/bin/vim' })])
    ).toBe('invalid')
    expect(
      validateExternalEditorList([editor(), editor({ name: 'Vim', executable: '/usr/bin/vim' })])
    ).toBe('invalid')
    expect(validateExternalEditorList([editor({ executable: 'nvim' })])).toBe('invalid')
  })
})
