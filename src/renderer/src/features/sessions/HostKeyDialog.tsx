import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useSessionsStore } from '@renderer/stores/sessions-store'
import type { HostKeyPrompt } from '@shared/protocols'
import { ShieldAlert, ShieldQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'

export function HostKeyDialog(): React.JSX.Element {
  const [prompt, setPrompt] = useState<HostKeyPrompt | null>(null)
  const [pending, setPending] = useState(false)
  const updateSessionState = useSessionsStore((s) => s.updateSessionState)
  const setAwaitingHostKey = useSessionsStore((s) => s.setAwaitingHostKey)

  useEffect(() => {
    const unsubState = window.north.sessions.onStateChanged((session) => {
      updateSessionState(session)
    })
    const unsubHost = window.north.sessions.onHostKeyPrompt((next) => {
      setPrompt(next)
      setAwaitingHostKey(next.sessionId, true)
    })
    return () => {
      unsubState()
      unsubHost()
    }
  }, [updateSessionState, setAwaitingHostKey])

  async function respond(accept: boolean): Promise<void> {
    if (!prompt) return
    setPending(true)
    try {
      await window.north.sessions.respondHostKey({
        requestId: prompt.requestId,
        accept
      })
      setAwaitingHostKey(prompt.sessionId, false)
      setPrompt(null)
      document.body.style.removeProperty('pointer-events')
    } finally {
      setPending(false)
      document.body.style.removeProperty('pointer-events')
    }
  }

  const open = prompt !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && prompt) {
          void respond(false)
        }
      }}
    >
      <DialogContent className="z-[100] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {prompt?.isMismatch ? (
              <ShieldAlert className="size-4 text-red-400" />
            ) : (
              <ShieldQuestion className="size-4 text-accent" />
            )}
            {prompt?.keyType === 'tls'
              ? prompt.isMismatch
                ? 'Certificado TLS alterado'
                : 'Confiar neste certificado TLS?'
              : prompt?.isMismatch
                ? 'Chave do host alterada'
                : 'Confiar neste host?'}
          </DialogTitle>
          <DialogDescription>
            {prompt?.keyType === 'tls'
              ? prompt.isMismatch
                ? 'O certificado TLS mudou desde a última conexão. Confirme antes de continuar.'
                : 'Primeira conexão TLS com este host. Confirme a fingerprint do certificado.'
              : prompt?.isMismatch
                ? 'A fingerprint mudou desde a última conexão. Isso pode indicar um ataque man-in-the-middle.'
                : 'Primeira conexão com este host. Confirme a fingerprint antes de continuar.'}
          </DialogDescription>
        </DialogHeader>

        {prompt ? (
          <div className="space-y-3 rounded-md border border-border bg-surface-elevated px-3 py-3 text-sm">
            <div>
              <p className="text-xs text-muted">Host</p>
              <p className="font-mono text-foreground">
                {prompt.host}:{prompt.port}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Tipo</p>
              <p className="font-mono text-foreground">{prompt.keyType}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Fingerprint (SHA256)</p>
              <p className="break-all font-mono text-[12px] text-foreground">
                {prompt.fingerprint}
              </p>
            </div>
            {prompt.isMismatch && prompt.previousFingerprint ? (
              <div>
                <p className="text-xs text-red-400">Fingerprint anterior</p>
                <p className="break-all font-mono text-[12px] text-muted">
                  {prompt.previousFingerprint}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void respond(false)}
          >
            Recusar
          </Button>
          <Button
            type="button"
            variant={prompt?.isMismatch ? 'destructive' : 'default'}
            disabled={pending}
            onClick={() => void respond(true)}
          >
            {prompt?.isMismatch ? 'Substituir e confiar' : 'Confiar e conectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
