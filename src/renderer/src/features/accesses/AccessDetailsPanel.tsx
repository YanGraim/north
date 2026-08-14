import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { EmptyState } from '@renderer/components/EmptyState'
import { EnvironmentBadge } from '@renderer/components/EnvironmentBadge'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Separator } from '@renderer/components/ui/separator'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { DetailField, DetailSection } from '@renderer/features/connections/DetailSection'
import { MarkdownNotes } from '@renderer/features/connections/MarkdownNotes'
import { TagBadges } from '@renderer/features/connections/TagBadges'
import { useAccess, useDeleteAccess, useToggleFavoriteAccess } from '@renderer/hooks/use-accesses'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { useSelectedAccessId } from '@renderer/hooks/use-route-selection'
import { useAccessTags } from '@renderer/hooks/use-tags'
import { useHasSecret, useRevealSecret } from '@renderer/hooks/use-vault'
import {
  accessTypeLabel,
  buildConnectionString,
  engineLabel,
  sqlStudioReady,
  supportsSqlStudio
} from '@renderer/lib/access-ui'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { formatRelativeDate } from '@renderer/lib/connection-ui'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { openAccessSession } from '@renderer/stores/sessions-store'
import { useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  MousePointerClick,
  Star,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'

const REVEAL_TTL_MS = 15_000

export function AccessDetailsPanel(): React.JSX.Element {
  const { accessId, setAccessId } = useSelectedAccessId()
  const { data: access, isLoading, isError } = useAccess(accessId ?? undefined)
  const { data: tags = [] } = useAccessTags(accessId ?? undefined)
  const { data: hasSecret = false } = useHasSecret(access?.credentialRef)
  const revealSecret = useRevealSecret()
  const { resolveGroup } = useOrgLookup()
  const toggleFavorite = useToggleFavoriteAccess()
  const deleteAccess = useDeleteAccess()
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revealed, setRevealed] = useState<{ accessId: string; secret: string } | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!revealed) return
    const timer = window.setTimeout(() => setRevealed(null), REVEAL_TTL_MS)
    return () => window.clearTimeout(timer)
  }, [revealed])

  const shownSecret =
    revealed && accessId && revealed.accessId === accessId ? revealed.secret : null

  async function handleReveal(): Promise<void> {
    if (!access?.credentialRef || !accessId) return
    if (shownSecret) {
      setRevealed(null)
      return
    }
    try {
      const secret = await revealSecret.mutateAsync(access.credentialRef)
      setRevealed({ accessId, secret })
    } catch {
      /* toast already shown */
    }
  }

  async function handleCopyPassword(): Promise<void> {
    if (!access?.credentialRef || !accessId) return
    try {
      const secret = shownSecret ?? (await revealSecret.mutateAsync(access.credentialRef))
      await copyToClipboard(secret, 'Senha')
      if (!shownSecret) setRevealed({ accessId, secret })
    } catch {
      /* toast already shown */
    }
  }

  async function handleCopyConnectionString(): Promise<void> {
    if (!access || !accessId) return
    try {
      let password: string | null = null
      if (access.credentialRef) {
        password = shownSecret ?? (await revealSecret.mutateAsync(access.credentialRef))
        if (!shownSecret && password) setRevealed({ accessId, secret: password })
      }
      const conn = buildConnectionString(access, password)
      if (!conn) {
        toastError('Não há dados suficientes para a connection string')
        return
      }
      await copyToClipboard(conn, 'Connection string')
    } catch {
      /* toast already shown */
    }
  }

  async function handleConnect(): Promise<void> {
    if (!access) return
    if (!sqlStudioReady(access)) {
      openDialog({ type: 'access', mode: 'edit', id: access.id })
      return
    }
    setConnecting(true)
    try {
      await openAccessSession(access.id, {
        title: access.name,
        protocol: access.engine ?? undefined,
        sessionKind: 'database',
        username: access.username,
        host: access.host
      })
    } catch (error) {
      toastError(error, 'Não foi possível conectar. Verifique host, porta e senha.')
    } finally {
      setConnecting(false)
    }
  }

  if (!accessId) {
    return (
      <EmptyState
        icon={MousePointerClick}
        title="Selecione um item"
        description="Escolha uma conexão ou acesso na lista."
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 overflow-hidden p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Separator />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (isError || !access) {
    return (
      <EmptyState
        icon={MousePointerClick}
        title="Acesso não encontrado"
        description="O item selecionado pode ter sido removido."
      />
    )
  }

  const org = resolveGroup(access.groupId)
  const maskedPassword = hasSecret ? (shownSecret ?? '••••••••') : '—'

  return (
    <>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {access.name}
            </h2>
            <div className="flex shrink-0 items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={access.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                disabled={toggleFavorite.isPending}
                onClick={() => toggleFavorite.mutate(access.id)}
              >
                <Star
                  className={
                    access.isFavorite ? 'size-3.5 fill-accent text-accent' : 'size-3.5 text-muted'
                  }
                />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Mais ações"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {access.username ? (
                    <DropdownMenuItem
                      onSelect={() => void copyToClipboard(access.username as string, 'Usuário')}
                    >
                      Copiar usuário
                    </DropdownMenuItem>
                  ) : null}
                  {hasSecret ? (
                    <DropdownMenuItem onSelect={() => void handleCopyPassword()}>
                      Copiar senha
                    </DropdownMenuItem>
                  ) : null}
                  {access.type === 'database' ? (
                    <DropdownMenuItem onSelect={() => void handleCopyConnectionString()}>
                      Copiar connection string
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Fechar detalhes"
                title="Fechar"
                onClick={() => setAccessId(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="default">{accessTypeLabel(access.type)}</Badge>
            {access.engine ? <Badge variant="outline">{engineLabel(access.engine)}</Badge> : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {access.type === 'database' ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 min-w-0 flex-1"
                disabled={connecting || !supportsSqlStudio(access)}
                title={
                  supportsSqlStudio(access) ? undefined : 'Este engine não abre sessão SQL no North'
                }
                onClick={() => void handleConnect()}
                data-testid="connect-button"
              >
                {connecting ? 'Conectando…' : 'Conectar'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 min-w-0 flex-1"
              onClick={() => openDialog({ type: 'access', mode: 'edit', id: access.id })}
            >
              Editar
            </Button>
            {access.url ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 min-w-0 flex-1"
                onClick={() => {
                  window.open(access.url as string, '_blank', 'noreferrer')
                  toastSuccess('Abrindo no browser…')
                }}
              >
                <ExternalLink className="size-3.5" />
                Abrir URL
              </Button>
            ) : null}
          </div>
        </header>

        <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="min-w-0 space-y-5 overflow-x-hidden p-4">
            <DetailSection title="Credenciais">
              <dl className="min-w-0 space-y-2.5">
                {access.url ? <DetailField label="URL" value={access.url} mono /> : null}
                {access.type === 'database' ? (
                  <>
                    <DetailField label="Engine" value={engineLabel(access.engine)} />
                    <DetailField
                      label="Host"
                      value={
                        access.host ? `${access.host}${access.port ? `:${access.port}` : ''}` : '—'
                      }
                      mono
                    />
                    <DetailField label="Database" value={access.database ?? '—'} mono />
                    <DetailField label="SSL" value={access.ssl ? 'Sim' : 'Não'} />
                  </>
                ) : null}
                <DetailField label="Usuário" value={access.username ?? '—'} mono />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Senha</dt>
                  <dd className="mt-1 flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-sm text-foreground">
                      {maskedPassword}
                    </span>
                    {hasSecret ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={shownSecret ? 'Ocultar senha' : 'Revelar senha'}
                          disabled={revealSecret.isPending}
                          onClick={() => void handleReveal()}
                        >
                          {shownSecret ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Copiar senha"
                          disabled={revealSecret.isPending}
                          onClick={() => void handleCopyPassword()}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </dd>
                </div>
                {access.type === 'database' ? (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!access.host}
                      onClick={() => void handleCopyConnectionString()}
                    >
                      <Copy className="size-3.5" />
                      Copiar connection string
                    </Button>
                  </div>
                ) : null}
              </dl>
            </DetailSection>

            <Separator />

            <DetailSection title="Organização">
              <dl className="min-w-0 space-y-3">
                <DetailField label="Cliente" value={org.client?.name ?? '—'} />
                <DetailField
                  label="Ambiente"
                  value={
                    org.environment ? (
                      <EnvironmentBadge
                        name={org.environment.name}
                        color={org.environment.color}
                        showFullName
                      />
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailField label="Grupo" value={org.group?.name ?? '—'} />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Tags</dt>
                  <dd className="mt-1.5 min-w-0">
                    {tags.length > 0 ? (
                      <TagBadges tags={tags} />
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </DetailSection>

            <Separator />

            <DetailSection title="Metadados">
              <dl className="min-w-0 space-y-3">
                <DetailField label="Criado" value={formatRelativeDate(access.createdAt)} />
                {access.description ? (
                  <DetailField label="Descrição" value={access.description} />
                ) : null}
              </dl>
            </DetailSection>

            <Separator />
            <DetailSection title="Notas">
              <MarkdownNotes
                notes={access.notes}
                onSave={async (notes) => {
                  await window.north.accesses.update(access.id, { notes })
                  void queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all })
                }}
              />
            </DetailSection>
          </div>
        </ScrollArea>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir acesso?"
        description={`O acesso “${access.name}” será removido permanentemente.`}
        confirming={deleteAccess.isPending}
        onConfirm={async () => {
          await deleteAccess.mutateAsync(access.id)
          setAccessId(null)
          setConfirmOpen(false)
        }}
      />
    </>
  )
}
