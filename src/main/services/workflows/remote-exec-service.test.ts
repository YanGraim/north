import { describe, expect, it, vi } from 'vitest'
import type { RemoteExecResult, RemoteExecSession } from './remote-exec-service'

describe('RemoteExecService session contract', () => {
  it('uses one session for multiple execs and disposes once', async () => {
    const execCalls: string[] = []
    let disposed = false

    const session: RemoteExecSession = {
      async exec(command): Promise<RemoteExecResult> {
        if (disposed) throw new Error('disposed')
        execCalls.push(command)
        return { exitCode: 0, stdout: 'ok', stderr: '' }
      },
      async dispose() {
        disposed = true
      }
    }

    const openSession = vi.fn(async () => session)

    const opened = await openSession()
    await opened.exec('echo 1')
    await opened.exec('echo 2')
    await opened.dispose()

    expect(openSession).toHaveBeenCalledOnce()
    expect(execCalls).toEqual(['echo 1', 'echo 2'])
    expect(disposed).toBe(true)
    await expect(opened.exec('echo 3')).rejects.toThrow(/disposed/)
  })

  it('maps non-zero exitCode as failure at call site', async () => {
    const session: RemoteExecSession = {
      async exec() {
        return { exitCode: 2, stdout: '', stderr: 'fail' }
      },
      async dispose() {
        return
      }
    }
    const result = await session.exec('false')
    expect(result.exitCode).not.toBe(0)
  })
})
