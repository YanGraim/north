import { zodResolver } from '@hookform/resolvers/zod'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { IconPicker } from '@renderer/components/IconPicker'
import { TagInput } from '@renderer/components/TagInput'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@renderer/components/ui/form'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { useCreateClient } from '@renderer/hooks/use-clients'
import {
  useConnection,
  useCreateConnection,
  useUpdateConnection
} from '@renderer/hooks/use-connections'
import { useCreateEnvironment } from '@renderer/hooks/use-environments'
import { useCreateGroup } from '@renderer/hooks/use-groups'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { useConnectionTags, useSetConnectionTags } from '@renderer/hooks/use-tags'
import { useDeleteSecret, useHasSecret, useVaultAvailable } from '@renderer/hooks/use-vault'
import { defaultPortForProtocol } from '@renderer/lib/protocol-defaults'
import { queryKeys } from '@renderer/lib/query-keys'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import {
  AuthMethodSchema,
  ConnectionProtocolSchema,
  type CreateConnectionInput,
  SERIAL_BAUD_RATES
} from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

const CREATE_CLIENT = '__create_client__'
const CREATE_ENVIRONMENT = '__create_environment__'
const CREATE_GROUP = '__create_group__'

const FormSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  description: z.string().nullable().optional(),
  protocol: ConnectionProtocolSchema,
  host: z.string().min(1, 'Informe o host'),
  port: z.number().int().positive('Porta inválida'),
  username: z.string().nullable().optional(),
  authMethod: AuthMethodSchema,
  privateKeyPath: z.string().nullable().optional(),
  password: z.string().optional(),
  clientId: z.string().uuid('Selecione o cliente'),
  environmentId: z.string().uuid('Selecione o ambiente'),
  groupId: z.string().uuid('Selecione o grupo'),
  owner: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  vpnRequired: z.boolean(),
  notes: z.string().nullable().optional(),
  tagIds: z.array(z.string().uuid())
})

type FormValues = z.infer<typeof FormSchema>

export function ConnectionFormDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const dialog = useInventoryDialogsStore((s) => s.dialog)
  const close = useInventoryDialogsStore((s) => s.close)
  const open = dialog?.type === 'connection'
  const mode = open ? dialog.mode : 'create'
  const editId = open && dialog.mode === 'edit' ? dialog.id : undefined
  const createGroupId = open && dialog.mode === 'create' ? (dialog.groupId ?? '') : ''
  const createEnvironmentId = open && dialog.mode === 'create' ? (dialog.environmentId ?? '') : ''
  const createClientId = open && dialog.mode === 'create' ? (dialog.clientId ?? '') : ''

  const { clients, environments, groups, resolveGroup } = useOrgLookup()
  const { data: existing } = useConnection(editId)
  const { data: loadedTags } = useConnectionTags(editId)
  const existingTagIdsKey = useMemo(
    () => (loadedTags ?? []).map((tag) => tag.id).join(','),
    [loadedTags]
  )
  const createConnection = useCreateConnection()
  const updateConnection = useUpdateConnection()
  const setConnectionTags = useSetConnectionTags()
  const { data: vaultAvailable = false } = useVaultAvailable()
  const { data: hasSecret = false } = useHasSecret(existing?.credentialRef)
  const deleteSecret = useDeleteSecret()

  const [passwordMode, setPasswordMode] = useState<'keep' | 'replace' | 'set'>('set')
  const [removingSecret, setRemovingSecret] = useState(false)
  const [quickCreate, setQuickCreate] = useState<'client' | 'environment' | 'group' | null>(null)
  const [quickCreateName, setQuickCreateName] = useState('')
  const resetSessionRef = useRef<string | null>(null)

  const createClient = useCreateClient()
  const createEnvironment = useCreateEnvironment()
  const createGroup = useCreateGroup()

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      description: null,
      protocol: 'ssh',
      host: '',
      port: 22,
      username: null,
      authMethod: 'password',
      privateKeyPath: null,
      password: '',
      clientId: '',
      environmentId: '',
      groupId: '',
      owner: null,
      icon: null,
      color: null,
      vpnRequired: false,
      notes: null,
      tagIds: []
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true
  })

  const watchedClientId = form.watch('clientId')
  const watchedEnvironmentId = form.watch('environmentId')
  const watchedProtocol = form.watch('protocol')
  const watchedAuthMethod = form.watch('authMethod')

  const clientEnvironments = useMemo(
    () => environments.filter((e) => e.clientId === watchedClientId),
    [environments, watchedClientId]
  )
  const environmentGroups = useMemo(
    () => groups.filter((g) => g.environmentId === watchedEnvironmentId),
    [groups, watchedEnvironmentId]
  )

  useEffect(() => {
    if (!open) {
      resetSessionRef.current = null
      return
    }

    const sessionKey =
      mode === 'edit'
        ? existing
          ? `edit:${existing.id}:${existingTagIdsKey}`
          : null
        : `create:${createGroupId}:${createEnvironmentId}:${createClientId}`

    if (!sessionKey || resetSessionRef.current === sessionKey) return
    resetSessionRef.current = sessionKey

    if (mode === 'edit' && existing) {
      const org = resolveGroup(existing.groupId)
      form.reset({
        name: existing.name,
        description: existing.description,
        protocol: existing.protocol,
        host: existing.host,
        port: existing.port,
        username: existing.username,
        authMethod: existing.authMethod,
        privateKeyPath: existing.privateKeyPath,
        password: '',
        clientId: org.client?.id ?? '',
        environmentId: org.environment?.id ?? '',
        groupId: existing.groupId,
        owner: existing.owner,
        icon: existing.icon,
        color: existing.color,
        vpnRequired: existing.vpnRequired,
        notes: existing.notes,
        tagIds: existingTagIdsKey ? existingTagIdsKey.split(',') : []
      })
      setPasswordMode(existing.credentialRef ? 'keep' : 'set')
      setRemovingSecret(false)
      return
    }

    const groupId = createGroupId
    const org = groupId ? resolveGroup(groupId) : null
    form.reset({
      name: '',
      description: null,
      protocol: 'ssh',
      host: '',
      port: 22,
      username: null,
      authMethod: 'password',
      privateKeyPath: null,
      password: '',
      clientId: createClientId || org?.client?.id || '',
      environmentId: createEnvironmentId || org?.environment?.id || '',
      groupId,
      owner: null,
      icon: null,
      color: null,
      vpnRequired: false,
      notes: null,
      tagIds: []
    })
    setPasswordMode('set')
    setRemovingSecret(false)
  }, [
    open,
    mode,
    existing,
    existingTagIdsKey,
    createGroupId,
    createEnvironmentId,
    createClientId,
    form,
    resolveGroup
  ])

  useEffect(() => {
    if (!open || mode !== 'create') return
    form.setValue('port', defaultPortForProtocol(watchedProtocol))
  }, [watchedProtocol, open, mode, form])

  async function persistSecret(
    password: string | undefined,
    currentRef: string | null
  ): Promise<string | null> {
    if (removingSecret && currentRef) {
      await window.north.vault.deleteSecret(currentRef)
      return null
    }

    if (passwordMode === 'keep') {
      return currentRef
    }

    const trimmed = password?.trim() ?? ''
    if (!trimmed) {
      return currentRef
    }

    if (!vaultAvailable) {
      return currentRef
    }

    return window.north.vault.setSecret({
      secret: trimmed,
      credentialRef: currentRef ?? undefined
    })
  }

  async function onSubmit(values: FormValues): Promise<void> {
    const credentialRef =
      mode === 'edit'
        ? await persistSecret(values.password, existing?.credentialRef ?? null)
        : await persistSecret(values.password, null)

    const payload: CreateConnectionInput = {
      groupId: values.groupId,
      name: values.name,
      description: values.description ?? null,
      protocol: values.protocol,
      host: values.host,
      port: values.port,
      username: values.username ?? null,
      authMethod: values.authMethod,
      credentialRef,
      privateKeyPath: values.privateKeyPath ?? null,
      owner: values.owner ?? null,
      icon: values.icon ?? null,
      color: values.color ?? null,
      vpnRequired: values.vpnRequired,
      notes: values.notes ?? null
    }

    if (mode === 'edit' && editId) {
      await updateConnection.mutateAsync({
        id: editId,
        input: payload
      })
      await setConnectionTags.mutateAsync({ connectionId: editId, tagIds: values.tagIds })
    } else {
      const created = await createConnection.mutateAsync(payload)
      if (values.tagIds.length > 0) {
        await setConnectionTags.mutateAsync({ connectionId: created.id, tagIds: values.tagIds })
      }
    }
    close()
  }

  const pending =
    createConnection.isPending ||
    updateConnection.isPending ||
    setConnectionTags.isPending ||
    deleteSecret.isPending

  const showPasswordField =
    watchedAuthMethod === 'password' &&
    (passwordMode === 'set' || passwordMode === 'replace' || !hasSecret)

  const quickCreatePending =
    createClient.isPending || createEnvironment.isPending || createGroup.isPending

  async function submitQuickCreate(): Promise<void> {
    const name = quickCreateName.trim()
    if (!name || !quickCreate) return

    if (quickCreate === 'client') {
      const client = await createClient.mutateAsync({ name })
      form.setValue('clientId', client.id)
      form.setValue('environmentId', '')
      form.setValue('groupId', '')
    } else if (quickCreate === 'environment') {
      const clientId = form.getValues('clientId')
      if (!clientId) return
      const environment = await createEnvironment.mutateAsync({ clientId, name })
      form.setValue('environmentId', environment.id)
      form.setValue('groupId', '')
    } else {
      const environmentId = form.getValues('environmentId')
      if (!environmentId) return
      const group = await createGroup.mutateAsync({ environmentId, name })
      form.setValue('groupId', group.id)
    }

    setQuickCreate(null)
    setQuickCreateName('')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? t('connection.form.editTitle') : t('connection.form.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('connection.form.description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Geral</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="API produção" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Resumo curto"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="protocol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protocolo</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Protocolo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ConnectionProtocolSchema.options.map((protocol) => (
                              <SelectItem key={protocol} value={protocol}>
                                {protocol.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-start gap-3">
                    <FormField
                      control={form.control}
                      name="icon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ícone</FormLabel>
                          <FormControl>
                            <IconPicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cor</FormLabel>
                          <FormControl>
                            <ColorPicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Acesso</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {watchedProtocol === 'serial' ? (
                    <>
                      <SerialPortField form={form} />
                      <FormField
                        control={form.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Baud rate</FormLabel>
                            <Select
                              value={String(field.value)}
                              onValueChange={(value) => field.onChange(Number(value))}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SERIAL_BAUD_RATES.map((rate) => (
                                  <SelectItem key={rate} value={String(rate)}>
                                    {rate}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host</FormLabel>
                            <FormControl>
                              <Input className="font-mono" placeholder="10.0.0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Porta</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                className="font-mono"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuário</FormLabel>
                        <FormControl>
                          <Input
                            className="font-mono"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="authMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Autenticação</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="password">Senha</SelectItem>
                            <SelectItem value="key">Chave</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="none">Nenhuma</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedAuthMethod === 'password' ? (
                    <div className="space-y-2 sm:col-span-2">
                      {!vaultAvailable ? (
                        <p className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs text-muted">
                          Criptografia de credenciais indisponível neste sistema. O campo de senha é
                          opcional — nenhum segredo será armazenado.
                        </p>
                      ) : null}

                      {mode === 'edit' &&
                      hasSecret &&
                      passwordMode === 'keep' &&
                      !removingSecret ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2">
                          <span className="text-sm text-foreground">Senha definida</span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7"
                            disabled={!vaultAvailable}
                            onClick={() => setPasswordMode('replace')}
                          >
                            Substituir
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-red-400"
                            onClick={() => {
                              setRemovingSecret(true)
                              setPasswordMode('set')
                              form.setValue('password', '')
                            }}
                          >
                            Remover
                          </Button>
                        </div>
                      ) : null}

                      {showPasswordField || removingSecret ? (
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {passwordMode === 'replace' ? 'Nova senha' : 'Senha'}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  autoComplete="new-password"
                                  disabled={!vaultAvailable}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Write-only — a senha nunca é lida de volta do vault.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {watchedAuthMethod === 'key' ? (
                    <FormField
                      control={form.control}
                      name="privateKeyPath"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Caminho da chave</FormLabel>
                          <FormControl>
                            <Input
                              className="font-mono"
                              placeholder="~/.ssh/id_ed25519"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
                  Organização
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            if (value === CREATE_CLIENT) {
                              setQuickCreate('client')
                              setQuickCreateName('')
                              return
                            }
                            field.onChange(value)
                            form.setValue('environmentId', '')
                            form.setValue('groupId', '')
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={CREATE_CLIENT} className="text-accent">
                              + Criar cliente
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="environmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ambiente</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            if (value === CREATE_ENVIRONMENT) {
                              setQuickCreate('environment')
                              setQuickCreateName('')
                              return
                            }
                            field.onChange(value)
                            form.setValue('groupId', '')
                          }}
                          disabled={!watchedClientId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Ambiente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientEnvironments.map((env) => (
                              <SelectItem key={env.id} value={env.id}>
                                {env.name}
                              </SelectItem>
                            ))}
                            {watchedClientId ? (
                              <SelectItem value={CREATE_ENVIRONMENT} className="text-accent">
                                + Criar ambiente
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="groupId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            if (value === CREATE_GROUP) {
                              setQuickCreate('group')
                              setQuickCreateName('')
                              return
                            }
                            field.onChange(value)
                          }}
                          disabled={!watchedEnvironmentId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Grupo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {environmentGroups.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name}
                              </SelectItem>
                            ))}
                            {watchedEnvironmentId ? (
                              <SelectItem value={CREATE_GROUP} className="text-accent">
                                + Criar grupo
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="owner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tagIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <TagInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
                  Operação
                </h3>
                <FormField
                  control={form.control}
                  name="vpnRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal text-muted">VPN obrigatória</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Checklist, links e observações"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={pending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Salvando…' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={quickCreate !== null}
        onOpenChange={(next) => {
          if (!next) {
            setQuickCreate(null)
            setQuickCreateName('')
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {quickCreate === 'client'
                ? 'Novo cliente'
                : quickCreate === 'environment'
                  ? 'Novo ambiente'
                  : 'Novo grupo'}
            </DialogTitle>
            <DialogDescription>Informe um nome para usar nesta conexão.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome"
            value={quickCreateName}
            onChange={(e) => setQuickCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submitQuickCreate()
              }
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuickCreate(null)
                setQuickCreateName('')
              }}
              disabled={quickCreatePending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!quickCreateName.trim() || quickCreatePending}
              onClick={() => void submitQuickCreate()}
            >
              {quickCreatePending ? 'Criando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SerialPortField({ form }: { form: UseFormReturn<FormValues> }): React.JSX.Element {
  const { data: ports = [], isLoading } = useQuery({
    queryKey: queryKeys.serial.ports,
    queryFn: () => window.north.serial.listPorts()
  })

  return (
    <FormField
      control={form.control}
      name="host"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Porta serial</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Carregando…' : 'Selecione a porta'} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {ports.map((port) => (
                <SelectItem key={port.path} value={port.path}>
                  {port.path}
                  {port.manufacturer ? ` · ${port.manufacturer}` : ''}
                </SelectItem>
              ))}
              {field.value && !ports.some((p) => p.path === field.value) ? (
                <SelectItem value={field.value}>{field.value}</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          <FormDescription>Caminho do dispositivo (ex.: /dev/tty.usbserial)</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
