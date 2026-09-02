import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useApiCollections } from '@renderer/hooks/use-api'
import { useClients } from '@renderer/hooks/use-clients'
import { importPostmanCollection } from '@renderer/lib/api-collections'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { openApiStudioTab } from '@renderer/stores/sessions-store'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileJson, FileText, FolderInput, Pencil, RefreshCw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const GLOBAL_VALUE = '__global__'

type Step = 'menu' | 'import-postman' | 'export'

type CollectionTransferDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClientId?: string | null
}

export function CollectionTransferDialog({
  open,
  onOpenChange,
  defaultClientId = null
}: CollectionTransferDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: clients = [] } = useClients()
  const { data: collections = [] } = useApiCollections()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('menu')
  const [scope, setScope] = useState(GLOBAL_VALUE)
  const [fileName, setFileName] = useState<string | null>(null)
  const [document, setDocument] = useState<unknown>(null)
  const [importing, setImporting] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('menu')
    setScope(defaultClientId ?? GLOBAL_VALUE)
    setFileName(null)
    setDocument(null)
  }, [defaultClientId, open])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      setDocument(JSON.parse(text) as unknown)
      setFileName(file.name)
    } catch {
      setDocument(null)
      setFileName(null)
      toastError(new Error('invalid-json'), t('api.transfer.invalidJson'))
    }
  }

  async function handleImport(): Promise<void> {
    if (document === null) return
    setImporting(true)
    try {
      const clientId = scope === GLOBAL_VALUE ? null : scope
      const collection = await importPostmanCollection(document, clientId)
      queryClient.setQueriesData(
        { queryKey: ['api', 'collections'] },
        (old: typeof collections | undefined) => {
          if (!old) return [collection]
          if (old.some((item) => item.id === collection.id)) return old
          return [...old, collection]
        }
      )
      await queryClient.invalidateQueries({ queryKey: ['api'] })
      toastSuccess(t('api.studio.imported'))
      onOpenChange(false)
      openApiStudioTab({
        collectionId: collection.id,
        collectionName: collection.name,
        clientId: collection.clientId,
        title: collection.name
      })
    } catch (error) {
      toastError(error, t('api.studio.importError'))
    } finally {
      setImporting(false)
    }
  }

  async function handleExport(collectionId: string): Promise<void> {
    setExportingId(collectionId)
    try {
      const result = await window.north.api.collectionExport(collectionId)
      if (!result.canceled) {
        toastSuccess(t('api.studio.exported'))
        onOpenChange(false)
      }
    } catch (error) {
      toastError(error, t('api.studio.exportError'))
    } finally {
      setExportingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="relative flex h-12 items-center justify-center border-b border-border px-12">
          {step !== 'menu' ? (
            <button
              type="button"
              className="absolute left-3 inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-elevated hover:text-foreground"
              aria-label={t('common.back')}
              onClick={() => setStep('menu')}
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : null}
          <DialogTitle className="text-sm font-medium">{t('api.transfer.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('api.transfer.hint')}</DialogDescription>
          <DialogClose asChild>
            <button
              type="button"
              className="absolute right-3 inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-elevated hover:text-foreground"
              aria-label={t('common.close')}
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>

        {step === 'menu' ? (
          <div className="py-1">
            <MenuRow
              icon={Pencil}
              label={t('api.transfer.importPostman')}
              onClick={() => setStep('import-postman')}
            />
            <MenuRow icon={FileJson} label={t('api.transfer.importOpenApi')} disabled />
            <MenuRow icon={RefreshCw} label={t('api.transfer.importInsomnia')} disabled />
            <MenuRow icon={FileText} label={t('api.transfer.importHar')} disabled />
            <MenuRow
              icon={FolderInput}
              label={t('api.transfer.exportJson')}
              disabled={collections.length === 0}
              onClick={() => setStep('export')}
            />
          </div>
        ) : null}

        {step === 'import-postman' ? (
          <div className="flex flex-col gap-4 p-4">
            <div className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <FolderInput className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{t('api.transfer.importFromFile')}</p>
                <p className="text-xs text-muted">{t('api.transfer.importFromFileHint')}</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void handleFileChange(event)}
            />
            <label
              htmlFor={fileInputId}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-3 py-4 hover:border-accent/50 hover:bg-surface-elevated/40"
            >
              <span className="rounded-md bg-surface-elevated px-2.5 py-1.5 text-xs font-medium">
                {t('api.transfer.chooseFiles')}
              </span>
              <span className="truncate text-xs text-muted">
                {fileName ?? t('api.transfer.noFiles')}
              </span>
            </label>
            <div className="grid gap-1.5">
              <Label>{t('api.scope.label')}</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL_VALUE}>{t('api.scope.global')}</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={document === null || importing}
              onClick={() => void handleImport()}
            >
              {t('api.studio.import')}
            </Button>
          </div>
        ) : null}

        {step === 'export' ? (
          <div className="py-1">
            <p className="px-4 py-2 text-xs text-muted">{t('api.transfer.pickCollection')}</p>
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-surface-elevated"
                disabled={exportingId !== null}
                onClick={() => void handleExport(collection.id)}
              >
                {collection.name}
              </button>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MenuRow({
  icon: Icon,
  label,
  disabled,
  onClick
}: {
  icon: typeof Pencil
  label: string
  disabled?: boolean
  onClick?: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left text-sm',
        disabled ? 'cursor-not-allowed text-muted' : 'text-foreground hover:bg-surface-elevated'
      )}
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {disabled ? <span className="text-[11px] text-muted">{t('api.transfer.soon')}</span> : null}
    </button>
  )
}
