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
import { defaultPortForEngine, engineLabel } from '@renderer/lib/access-ui'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { openAccessSession } from '@renderer/stores/sessions-store'
import { isSqlStudioEngine } from '@shared/protocols'
import { type CreateAccessInput, DatabaseEngineSchema } from '@shared/types'
import { FolderOpen } from 'lucide-react'
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
    description: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    password: z.string().optional(),
    engine: DatabaseEngineSchema,
    host: z.string().nullable().optional(),
    port: z.number().int().positive().nullable().optional(),
    database: z.string().nullable().optional(),
    ssl: z.boolean().nullable().optional(),
    url: z.string().nullable().optional(),
    clientId: z.string().uuid('Selecione o cliente'),
    environmentId: z.string().uuid('Selecione o ambiente'),
    groupId: z.string().uuid('Selecione o grupo'),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    tagIds: z.array(z.string().uuid())
  })
  .superRefine((values, ctx) => {
    if (!values.host?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: values.engine === 'sqlite' ? 'Informe o arquivo' : 'Informe o host',
        path: ['host']
      })
    }
    if (values.engine !== 'sqlite' && !values.port) {
      ctx.addIssue({ code: 'custom', message: 'Informe a porta', path: ['port'] })
    }
  })

type FormValues = z.infer<typeof FormSchema>

export function DatabaseConnectionFormDialog(): React.JSX.Element | null {
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
  const [testing, setTesting] = useState(false)
  const [connectingAfterSave, setConnectingAfterSave] = useState(false)
  const resetSessionRef = useRef<string | null>(null)

  const createClient = useCreateClient()
  const createEnvironment = useCreateEnvironment()
  const createGroup = useCreateGroup()

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      description: null,
      username: null,
      password: '',
      engine: 'postgres',
      host: null,
      port: 5432,
      database: null,
      ssl: false,
      url: null,
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
  const watchedEngine = form.watch('engine')
  const isSqlite = watchedEngine === 'sqlite'
  const canStudio = isSqlStudioEngine(watchedEngine)

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
        : `create:${createGroupId}:${createEnvironmentId}:${createClientId}:database`

    if (!sessionKey || resetSessionRef.current === sessionKey) return
    resetSessionRef.current = sessionKey

    if (mode === 'edit' && existing) {
      const org = resolveGroup(existing.groupId)
      form.reset({
        name: existing.name,
        description: existing.description,
        username: existing.username,
        password: '',
        engine: existing.engine ?? 'postgres',
        host: existing.host,
        port: existing.port,
        database: existing.database,
        ssl: existing.ssl,
        url: existing.url,
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
    form.reset({
      name: '',
      description: null,
      username: null,
      password: '',
      engine: 'postgres',
      host: null,
      port: 5432,
      database: null,
      ssl: false,
      url: null,
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
    form,
    resolveGroup
  ])

  useEffect(() => {
    if (!open || !watchedEngine) return
    if (watchedEngine === 'sqlite') {
      form.setValue('port', null)
      form.setValue('ssl', false)
      return
    }
    if (mode === 'create') {
      form.setValue('port', defaultPortForEngine(watchedEngine))
    }
  }, [watchedEngine, open, mode, form])

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

  async function persist(values: FormValues): Promise<string> {
    const credentialRef =
      mode === 'edit'
        ? await persistSecret(values.password, existing?.credentialRef ?? null)
        : await persistSecret(values.password, null)

    const payload: CreateAccessInput = {
      groupId: values.groupId,
      type: 'database',
      name: values.name,
      description: values.description ?? null,
      username: values.username ?? null,
      credentialRef,
      url: values.url ?? null,
      notes: values.notes ?? null,
      icon: values.icon ?? null,
      color: values.color ?? null,
      engine: values.engine,
      host: values.host ?? null,
      port: values.engine === 'sqlite' ? null : (values.port ?? null),
      database: values.database ?? null,
      ssl: values.engine === 'sqlite' ? false : (values.ssl ?? false)
    }

    if (mode === 'edit' && editId) {
      await updateAccess.mutateAsync({ id: editId, input: payload })
      await setAccessTags.mutateAsync({ accessId: editId, tagIds: values.tagIds })
      return editId
    }

    const created = await createAccess.mutateAsync(payload)
    if (values.tagIds.length > 0) {
      await setAccessTags.mutateAsync({ accessId: created.id, tagIds: values.tagIds })
    }
    return created.id
  }

  async function onSubmit(values: FormValues): Promise<void> {
    await persist(values)
    close()
  }

  async function onSaveAndConnect(): Promise<void> {
    const valid = await form.trigger()
    if (!valid) return
    setConnectingAfterSave(true)
    try {
      const id = await persist(form.getValues())
      close()
      await openAccessSession(id)
    } catch (error) {
      toastError(error, 'Não foi possível conectar')
    } finally {
      setConnectingAfterSave(false)
    }
  }

  async function onTest(): Promise<void> {
    const valid = await form.trigger(['engine', 'host', 'port'])
    if (!valid) return
    const values = form.getValues()
    if (!isSqlStudioEngine(values.engine)) {
      toastError('Este engine não abre sessão SQL no North')
      return
    }
    setTesting(true)
    try {
      const result = await window.north.db.test({
        engine: values.engine,
        host: values.host,
        port: values.engine === 'sqlite' ? null : values.port,
        database: values.database,
        username: values.username,
        ssl: values.ssl,
        password: values.password?.trim() ? values.password : undefined,
        accessId: mode === 'edit' ? editId : undefined,
        credentialRef:
          passwordMode === 'keep' && !values.password?.trim()
            ? (existing?.credentialRef ?? undefined)
            : undefined
      })
      if (result.ok) {
        toastSuccess(
          result.latencyMs != null
            ? `Conexão bem-sucedida (${Math.round(result.latencyMs)} ms)`
            : 'Conexão bem-sucedida'
        )
      } else {
        toastError(result.message ?? 'Falha ao testar a conexão')
      }
    } catch (error) {
      toastError(error, 'Falha ao testar a conexão')
    } finally {
      setTesting(false)
    }
  }

  async function pickSqliteFile(): Promise<void> {
    const path = await window.north.db.pickFile()
    if (path) form.setValue('host', path, { shouldValidate: true })
  }

  const pending =
    createAccess.isPending ||
    updateAccess.isPending ||
    setAccessTags.isPending ||
    connectingAfterSave
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

  if (!open) return null
  if (mode === 'create' && createAccessType !== 'database') return null
  if (mode === 'edit' && existing?.type !== 'database') return null

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? t('database.form.editTitle') : t('database.form.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('database.form.description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
                  {t('database.form.connection')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="engine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('database.form.engine')}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DatabaseEngineSchema.options.map((engine) => (
                              <SelectItem key={engine} value={engine}>
                                {engineLabel(engine)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isSqlite ? (
                    <FormField
                      control={form.control}
                      name="host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('database.form.file')}</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                className="font-mono"
                                placeholder="/path/to/app.db"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              aria-label={t('database.form.browse')}
                              onClick={() => void pickSqliteFile()}
                            >
                              <FolderOpen className="size-3.5" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('database.form.host')}</FormLabel>
                            <FormControl>
                              <Input
                                className="font-mono"
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
                            <FormLabel>{t('database.form.port')}</FormLabel>
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
                            <FormLabel>{t('database.form.database')}</FormLabel>
                            <FormControl>
                              <Input
                                className="font-mono"
                                placeholder="app_prod"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value || null)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {!isSqlite ? (
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('database.form.username')}</FormLabel>
                          <FormControl>
                            <Input
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ) : null}

                  {!isSqlite ? (
                    <div className="space-y-2">
                      {!vaultAvailable ? (
                        <p className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs text-muted">
                          Vault indisponível neste ambiente.
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
                                {passwordMode === 'replace'
                                  ? 'Nova senha'
                                  : t('database.form.password')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  autoComplete="new-password"
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
                  ) : null}
                </div>
                {!isSqlite ? (
                  <FormField
                    control={form.control}
                    name="ssl"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-1">
                        <FormControl>
                          <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal text-muted">
                          {t('database.form.ssl')}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ) : null}
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Geral</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>{t('database.form.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder="PostgreSQL · wms" {...field} />
                        </FormControl>
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
                            <IconPicker
                              value={field.value}
                              onChange={field.onChange}
                              engine={watchedEngine}
                            />
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
                      <FormItem>
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

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={testing || !canStudio}
                  onClick={() => void onTest()}
                >
                  {testing ? t('database.form.testing') : t('database.form.test')}
                </Button>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={close}>
                    {t('database.form.cancel')}
                  </Button>
                  <Button type="submit" variant="secondary" disabled={pending}>
                    {pending && !connectingAfterSave
                      ? t('database.form.saving')
                      : mode === 'edit'
                        ? t('database.form.save')
                        : t('database.form.create')}
                  </Button>
                  {canStudio ? (
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => void onSaveAndConnect()}
                    >
                      {connectingAfterSave
                        ? t('database.form.connecting')
                        : t('database.form.saveAndConnect')}
                    </Button>
                  ) : null}
                </div>
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
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setQuickCreate(null)}>
              Cancelar
            </Button>
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
