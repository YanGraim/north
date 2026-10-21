import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { useAddOrganization } from '@renderer/hooks/use-workspaces'
import { formatIpcError } from '@renderer/lib/ipc-error'
import { workspacePath } from '@renderer/lib/workspace-paths'
import type { AddOrganizationInput, OrganizationServerInfo } from '@shared/types'
import { Building2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Step = { kind: 'address' } | { kind: 'sign-in'; info: OrganizationServerInfo }

/**
 * Two steps, like the Hoppscotch "add workspace" flow: which server, then who
 * you are — Microsoft (Entra, in the system browser) and/or the test e-mail
 * sign-in. Tokens never reach the renderer — main signs in and keeps them.
 */
export function AddOrganizationDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const add = useAddOrganization()
  const [step, setStep] = useState<Step>({ kind: 'address' })
  const [serverUrl, setServerUrl] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)
  const [entraPending, setEntraPending] = useState(false)

  const reset = (): void => {
    setStep({ kind: 'address' })
    setServerUrl('')
    setEmail('')
    setName('')
    setError(null)
    add.reset()
  }

  const close = (next: boolean): void => {
    if (!next && entraPending) cancelMicrosoft()
    if (!next) reset()
    onOpenChange(next)
  }

  const probe = async (): Promise<void> => {
    if (!serverUrl.trim() || probing) return
    setError(null)
    setProbing(true)
    try {
      const info = await window.north.workspaces.probe(serverUrl)
      if (!info.entra && !info.authModes.includes('dev')) {
        setError(t('workspaces.add.noSignIn'))
        return
      }
      setStep({ kind: 'sign-in', info })
    } catch (e) {
      setError(formatIpcError(e, t('workspaces.add.unreachable')))
    } finally {
      setProbing(false)
    }
  }

  const finish = async (input: AddOrganizationInput): Promise<void> => {
    setError(null)
    try {
      const workspace = await add.mutateAsync(input)
      close(false)
      void navigate(workspacePath(workspace.id, '/dashboard'))
    } catch (e) {
      setError(formatIpcError(e, t('workspaces.add.signInFailed')))
    }
  }

  const signIn = async (): Promise<void> => {
    if (!EMAIL.test(email.trim()) || add.isPending) return
    await finish({ serverUrl, email: email.trim(), name: name.trim() || undefined })
  }

  // Main opens the system browser and waits for Microsoft to send the person back.
  const signInWithMicrosoft = async (): Promise<void> => {
    if (add.isPending) return
    setEntraPending(true)
    try {
      await finish({ serverUrl })
    } finally {
      setEntraPending(false)
    }
  }

  const cancelMicrosoft = (): void => {
    void window.north.workspaces.cancelSignIn()
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('workspaces.addOrganization')}</DialogTitle>
          <DialogDescription>
            {step.kind === 'address'
              ? t('workspaces.add.addressHint')
              : t('workspaces.add.signInHint')}
          </DialogDescription>
        </DialogHeader>

        {step.kind === 'address' ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void probe()
            }}
          >
            <Label htmlFor="org-server-url">{t('workspaces.add.serverUrl')}</Label>
            <Input
              id="org-server-url"
              autoFocus
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="https://north.suaempresa.com"
              className="font-mono"
              spellCheck={false}
              autoComplete="url"
            />
            {error ? (
              <p role="alert" className="text-xs text-red-400">
                {error}
              </p>
            ) : null}
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {t('workspaces.add.cancel')}
              </Button>
              <Button type="submit" disabled={!serverUrl.trim() || probing}>
                {probing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {t('workspaces.add.continue')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="mb-1 flex items-center gap-2 rounded-md border border-border bg-surface-elevated/40 px-3 py-2">
              <Building2 className="size-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{step.info.name}</p>
                <p className="truncate font-mono text-[11px] text-muted">{serverUrl.trim()}</p>
              </div>
            </div>
            {step.info.entra ? (
              entraPending ? (
                <div className="flex flex-col gap-2" data-testid="entra-waiting">
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
                    {t('workspaces.add.entraWaiting')}
                  </p>
                  <Button type="button" variant="ghost" onClick={cancelMicrosoft}>
                    {t('workspaces.add.entraCancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  autoFocus
                  disabled={add.isPending}
                  onClick={() => void signInWithMicrosoft()}
                >
                  {t('workspaces.add.entraButton')}
                </Button>
              )
            ) : null}
            {error ? (
              <p role="alert" className="text-xs text-red-400">
                {error}
              </p>
            ) : null}
            {step.info.authModes.includes('dev') && !entraPending ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void signIn()
                }}
              >
                {step.info.entra ? (
                  <p className="mt-2 text-[11px] text-muted">{t('workspaces.add.orDev')}</p>
                ) : null}
                <Label htmlFor="org-email">{t('workspaces.add.email')}</Label>
                <Input
                  id="org-email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@suaempresa.com"
                  autoComplete="email"
                />
                <Label htmlFor="org-name">{t('workspaces.add.name')}</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
                <p className="text-[11px] text-muted">{t('workspaces.add.devNotice')}</p>
                <DialogFooter className="mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setError(null)
                      setStep({ kind: 'address' })
                    }}
                  >
                    {t('workspaces.add.back')}
                  </Button>
                  <Button type="submit" disabled={!EMAIL.test(email.trim()) || add.isPending}>
                    {add.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {t('workspaces.add.signIn')}
                  </Button>
                </DialogFooter>
              </form>
            ) : !entraPending ? (
              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setError(null)
                    setStep({ kind: 'address' })
                  }}
                >
                  {t('workspaces.add.back')}
                </Button>
              </DialogFooter>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
