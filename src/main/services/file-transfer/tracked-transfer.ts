import { randomUUID } from 'node:crypto'
import type {
  FileTransferCapability,
  TransferConflict,
  TransferHandle,
  TransferProgress
} from '@shared/protocols'
import { runTransfer, TransferCancelledError, type TransferPlan } from './transfer-runner'

const activeTransfers = new Map<string, AbortController>()

export function abortTrackedTransfer(transferId: string): void {
  activeTransfers.get(transferId)?.abort()
}

export function startTrackedTransfer(
  ft: FileTransferCapability,
  opts: {
    sessionId: string
    conflict?: TransferConflict
    direction: 'download' | 'upload'
    remotePath: string
    localPath: string
    plan: () => Promise<TransferPlan>
    onProgress: (progress: TransferProgress) => void
    onSettled?: () => void
    /** When false, a failure uses `fallbackError` and never the thrown message. */
    exposeError?: boolean
    fallbackError: string
  }
): TransferHandle {
  const transferId = randomUUID()
  const controller = new AbortController()
  activeTransfers.set(transferId, controller)
  const base = {
    transferId,
    sessionId: opts.sessionId,
    direction: opts.direction,
    remotePath: opts.remotePath,
    localPath: opts.localPath
  }

  void (async () => {
    try {
      const plan = await opts.plan()
      await runTransfer({
        ft,
        direction: opts.direction,
        plan,
        conflict: opts.conflict,
        signal: controller.signal,
        onProgress: (update) => opts.onProgress({ ...base, ...update, done: false })
      })
      opts.onProgress({ ...base, bytesTransferred: 0, totalBytes: null, done: true })
    } catch (error) {
      const cancelled = error instanceof TransferCancelledError
      const exposed =
        opts.exposeError === false
          ? opts.fallbackError
          : error instanceof Error
            ? error.message
            : opts.fallbackError
      opts.onProgress({
        ...base,
        bytesTransferred: 0,
        totalBytes: null,
        done: true,
        cancelled,
        error: cancelled ? null : exposed
      })
    } finally {
      activeTransfers.delete(transferId)
      opts.onSettled?.()
    }
  })()

  return { transferId }
}
