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
import { useAccess, useCreateAccess, useUpdateAccess } from '@renderer/hooks/use-accesses'
import { useCreateClient } from '@renderer/hooks/use-clients'
import { useCreateEnvironment } from '@renderer/hooks/use-environments'
import { useCreateGroup } from '@renderer/hooks/use-groups'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { useAccessTags, useSetAccessTags } from '@renderer/hooks/use-tags'
import { useHasSecret, useVaultAvailable } from '@renderer/hooks/use-vault'
import { defaultPortForEngine } from '@renderer/lib/access-ui'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { AccessTypeSchema, type CreateAccessInput, DatabaseEngineSchema } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

const CREATE_CLIENT = '__create_client__'
const CREATE_ENVIRONMENT = '__create_environment__'
const CREATE_GROUP = '__create_group__'

const FormSchema = z
  .object({
    name: z.string().min(1, 'Informe o nome'),
    type: AccessTypeSchema,
    description: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    password: z.string().optional(),
    url: z.string().nullable().optional(),
    engine: DatabaseEngineSchema.nullable().optional(),
    host: z.string().nullable().optional(),
    port: z.number().int().positive().nullable().optional(),
    database: z.string().nullable().optional(),
    ssl: z.boolean().nullable().optional(),
    clientId: z.string().uuid('Selecione o cliente'),
    environmentId: z.string().uuid('Selecione o ambiente'),
    groupId: z.string().uuid('Selecione o grupo'),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    tagIds: z.array(z.string().uuid())
  })
  .superRefine((values, ctx) => {
    if (values.type === 'database') {
      if (!values.host?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Informe o host', path: ['host'] })
      }
      if (!values.engine) {
        ctx.addIssue({ code: 'custom', message: 'Selecione o engine', path: ['engine'] })
      }
      if (!values.port) {
        ctx.addIssue({ code: 'custom', message: 'Informe a porta', path: ['port'] })
      }
    }
    if (values.type === 'login' && !values.url?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Informe a URL', path: ['url'] })
    }
  })

type FormValues = z.infer<typeof FormSchema>

export function AccessFormDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const dialog = useInventoryDialogsStore((s) => s.dialog)
  const close = useInventoryDialogsStore((s) => s.close)
  const open = dialog?.type === 'access'
  const mode = open ? dialog.mode : 'create'
  const editId = open && dialog.mode === 'edit' ? dialog.id : undefined
  const createGroupId = open && dialog.mode === 'create' ? (dialog.groupId ?? '') : ''
  const createEnvironmentId = open && dialog.mode === 'create' ? (dialog.environmentId ?? '') : ''
  const createClientId = open && dialog.mode === 'create' ? (dialog.clientId ?? '') : ''
  const createAccessType =
    open && dialog.mode === 'create' ? (dialog.accessType ?? 'login') : 'login'

  const { clients, environments, groups, resolveGroup } = useOrgLookup()
  const { data: existing } = useAccess(editId)
  const { data: loadedTags } = useAccessTags(editId)
  const existingTagIdsKey = useMemo(
    () => (loadedTags ?? []).map((tag) => tag.id).join(','),
    [loadedTags]
  )
  const createAccess = useCreateAccess()
  const updateAccess = useUpdateAccess()
  const setAccessTags = useSetAccessTags()
  const { data: vaultAvailable = false } = useVaultAvailable()
  const { data: hasSecret = false } = useHasSecret(existing?.credentialRef)

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
      type: 'login',
      description: null,
      username: null,
      password: '',
      url: null,
      engine: 'postgres',
      host: null,
      port: 5432,
      database: null,
      ssl: false,
      clientId: '',
      environmentId: '',
      groupId: '',
      icon: null,
      color: null,
      notes: null,
      tagIds: []
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true
  })

  const watchedClientId = form.watch('clientId')
  const watchedEnvironmentId = form.watch('environmentId')
  const watchedType = form.watch('type')
  const watchedEngine = form.watch('engine')

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
        : `create:${createGroupId}:${createEnvironmentId}:${createClientId}:${createAccessType}`

    if (!sessionKey || resetSessionRef.current === sessionKey) return
    resetSessionRef.current = sessionKey

    if (mode === 'edit' && existing) {
      const org = resolveGroup(existing.groupId)
      form.reset({
        name: existing.name,
        type: existing.type,
        description: existing.description,
        username: existing.username,
        password: '',
        url: existing.url,
        engine: existing.engine,
        host: existing.host,
        port: existing.port,
        database: existing.database,
        ssl: existing.ssl,
        clientId: org.client?.id ?? '',
        environmentId: org.environment?.id ?? '',
        groupId: existing.groupId,
        icon: existing.icon,
        color: existing.color,
        notes: existing.notes,
        tagIds: existingTagIdsKey ? existingTagIdsKey.split(',') : []
      })
      setPasswordMode(existing.credentialRef ? 'keep' : 'set')
      setRemovingSecret(false)
      return
    }

    const groupId = createGroupId
    const org = groupId ? resolveGroup(groupId) : null
    const type = createAccessType
    form.reset({
      name: '',
      type,
      description: null,
      username: null,
      password: '',
      url: null,
      engine: type === 'database' ? 'postgres' : null,
      host: null,
      port: type === 'database' ? 5432 : null,
      database: null,
      ssl: type === 'database' ? false : null,
      clientId: createClientId || org?.client?.id || '',
      environmentId: createEnvironmentId || org?.environment?.id || '',
      groupId,
      icon: null,
      color: null,
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
    createAccessType,
    form,
    resolveGroup
  ])

  useEffect(() => {
    if (!open || mode !== 'create' || watchedType !== 'database' || !watchedEngine) return
    form.setValue('port', defaultPortForEngine(watchedEngine))
  }, [watchedEngine, watchedType, open, mode, form])

  async function persistSecret(
    password: string | undefined,
    currentRef: string | null
  ): Promise<string | null> {
    if (removingSecret && currentRef) {
      await window.north.vault.deleteSecret(currentRef)
      return null
    }
    if (passwordMode === 'keep') return currentRef
    const trimmed = password?.trim() ?? ''
    if (!trimmed || !vaultAvailable) return currentRef
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

    const isDb = values.type === 'database'
    const payload: CreateAccessInput = {
      groupId: values.groupId,
      type: values.type,
      name: values.name,
      description: values.description ?? null,
      username: values.username ?? null,
      credentialRef,
      url: values.url ?? null,
      notes: values.notes ?? null,
      icon: values.icon ?? null,
      color: values.color ?? null,
      engine: isDb ? (values.engine ?? null) : null,
      host: isDb ? (values.host ?? null) : null,
      port: isDb ? (values.port ?? null) : null,
      database: isDb ? (values.database ?? null) : null,
      ssl: isDb ? (values.ssl ?? false) : null
    }

    if (mode === 'edit' && editId) {
      await updateAccess.mutateAsync({ id: editId, input: payload })
      await setAccessTags.mutateAsync({ accessId: editId, tagIds: values.tagIds })
    } else {
      const created = await createAccess.mutateAsync(payload)
      if (values.tagIds.length > 0) {
        await setAccessTags.mutateAsync({ accessId: created.id, tagIds: values.tagIds })
      }
    }
    close()
  }

  const pending = createAccess.isPending || updateAccess.isPending || setAccessTags.isPending

  const showPasswordField = passwordMode === 'set' || passwordMode === 'replace' || !hasSecret

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
              {mode === 'edit' ? t('access.form.editTitle') : t('access.form.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('access.form.description')}</DialogDescription>
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
                          <Input placeholder="Portal admin / Postgres prod" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            if (value === 'database') {
                              form.setValue('engine', form.getValues('engine') ?? 'postgres')
                              form.setValue('port', form.getValues('port') ?? 5432)
                              form.setValue('ssl', form.getValues('ssl') ?? false)
                            }
                          }}
                          disabled={mode === 'edit'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AccessTypeSchema.options.map((type) => (
                              <SelectItem key={type} value={type}>
                                {t(`access.type.${type}`)}
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
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
                  Credenciais
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(watchedType === 'login' || watchedType === 'other') && (
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://admin.cliente.com"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {watchedType === 'database' && (
                    <>
                      <FormField
                        control={form.control}
                        name="engine"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Engine</FormLabel>
                            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Engine" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DatabaseEngineSchema.options.map((engine) => (
                                  <SelectItem key={engine} value={engine}>
                                    {engine}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="db.internal"
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
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Porta</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                value={field.value ?? ''}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? Number(e.target.value) : null)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="database"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Database</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="app_prod"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ssl"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center gap-2 space-y-0">
                            <FormControl>
                              <Switch
                                checked={Boolean(field.value)}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-muted">SSL</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>URL admin (opcional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://pgadmin.cliente.com"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                              />
                            </FormControl>
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
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    {!vaultAvailable ? (
                      <p className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs text-muted">
                        Vault indisponível neste ambiente.
                      </p>
                    ) : null}

                    {mode === 'edit' && hasSecret && passwordMode === 'keep' && !removingSecret ? (
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
                          Trocar
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
                                placeholder={
                                  removingSecret ? 'Senha será removida' : 'Senha (vault)'
                                }
                                disabled={removingSecret || !vaultAvailable}
                                {...field}
                              />
                            </FormControl>
                            {vaultAvailable ? (
                              <FormDescription>
                                Write-only — a senha nunca é lida de volta do vault.
                              </FormDescription>
                            ) : null}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </div>
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
                          value={field.value || undefined}
                          onValueChange={(value) => {
                            if (value === CREATE_CLIENT) {
                              setQuickCreate('client')
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
                            <SelectItem value={CREATE_CLIENT}>+ Novo cliente</SelectItem>
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
                          value={field.value || undefined}
                          onValueChange={(value) => {
                            if (value === CREATE_ENVIRONMENT) {
                              setQuickCreate('environment')
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
                            {clientEnvironments.map((environment) => (
                              <SelectItem key={environment.id} value={environment.id}>
                                {environment.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={CREATE_ENVIRONMENT}>+ Novo ambiente</SelectItem>
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
                          value={field.value || undefined}
                          onValueChange={(value) => {
                            if (value === CREATE_GROUP) {
                              setQuickCreate('group')
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
                            <SelectItem value={CREATE_GROUP}>+ Novo grupo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="tagIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <TagInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </section>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>
                  {t('access.form.cancel')}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending
                    ? t('access.form.saving')
                    : mode === 'edit'
                      ? t('access.form.save')
                      : t('access.form.create')}
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
          </DialogHeader>
          <Input
            autoFocus
            value={quickCreateName}
            onChange={(e) => setQuickCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submitQuickCreate()
              }
            }}
            placeholder="Nome"
          />
          <DialogFooter>
            <Button
              type="button"
              disabled={!quickCreateName.trim() || quickCreatePending}
              onClick={() => void submitQuickCreate()}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
