import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Separator } from '@renderer/components/ui/separator'
import { useAppVersion } from '@renderer/hooks/use-app-version'
import {
  downloadCsvTemplate,
  exportInventory,
  importInventory,
  importInventoryCsv
} from '@renderer/lib/inventory-actions'
import { SHORTCUTS, shortcutDisplayLabel } from '@renderer/lib/shortcuts'
import {
  checkForUpdates,
  installAndRestart,
  updatesLikelyDisabledInDev
} from '@renderer/lib/update-actions'
import { type LocaleCode, type ThemePreference, useUiStore } from '@renderer/stores/ui-store'
import type { UpdateStatus } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Download, ExternalLink, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

const REPO_URL = 'https://github.com/YanGraim/north'

const PRIMARY_SHORTCUTS = [
  SHORTCUTS.commandPalette,
  SHORTCUTS.toggleSidebar,
  SHORTCUTS.newConnection,
  SHORTCUTS.closeTab
] as const

const LOCALE_OPTIONS: Array<{ value: LocaleCode; label: string }> = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' }
]

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: version, isLoading: versionLoading } = useAppVersion()
  const queryClient = useQueryClient()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const locale = useUiStore((s) => s.locale)
  const setLocale = useUiStore((s) => s.setLocale)
  const [busy, setBusy] = useState<
    'export' | 'import' | 'importCsv' | 'template' | 'check' | 'install' | null
  >(null)
  const [csvSecretsOpen, setCsvSecretsOpen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const updatesDisabled = updatesLikelyDisabledInDev()

  useEffect(() => {
    if (updatesDisabled) return

    void window.north.updates.getStatus().then(setUpdateStatus)
    return window.north.updates.onStatusChanged(setUpdateStatus)
  }, [updatesDisabled])

  const availableVersion = updateStatus?.available ? updateStatus.version : null
  const updateReady = updateStatus?.downloaded ?? false
  const updateDownloading = updateStatus?.downloading ?? false
  const updateChecking = updateStatus?.checking ?? false
  const downloadProgress = updateStatus?.progress

  async function onExport(): Promise<void> {
    setBusy('export')
    try {
      await exportInventory()
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(null)
    }
  }

  async function onImport(): Promise<void> {
    setBusy('import')
    try {
      await importInventory(queryClient)
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(null)
    }
  }

  async function onImportCsv(allowSecrets: boolean): Promise<void> {
    setCsvSecretsOpen(false)
    setBusy('importCsv')
    try {
      await importInventoryCsv(allowSecrets, queryClient)
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(null)
    }
  }

  async function onDownloadTemplate(): Promise<void> {
    setBusy('template')
    try {
      await downloadCsvTemplate()
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(null)
    }
  }

  async function onCheckUpdates(): Promise<void> {
    setBusy('check')
    try {
      await checkForUpdates()
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(null)
    }
  }

  async function onInstall(): Promise<void> {
    setBusy('install')
    try {
      await installAndRestart()
    } catch {
      /* toast já exibido */
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-sm font-medium text-foreground">{t('settings.title')}</h1>
        <p className="mt-0.5 text-xs text-muted">{t('settings.subtitle')}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-xl flex-col gap-8 p-4 pb-10">
          <SettingsSection
            title={t('settings.appearance.title')}
            description={t('settings.appearance.description')}
          >
            <Row label={t('settings.appearance.theme')}>
              <Select value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">{t('settings.appearance.dark')}</SelectItem>
                  <SelectItem value="light">{t('settings.appearance.light')}</SelectItem>
                  <SelectItem value="system">{t('settings.appearance.system')}</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </SettingsSection>

          <Separator />

          <SettingsSection
            title={t('settings.language.title')}
            description={t('settings.language.description')}
          >
            <Row label={t('settings.language.label')}>
              <Select value={locale} onValueChange={(value) => setLocale(value as LocaleCode)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </SettingsSection>

          <Separator />

          <SettingsSection
            title={t('settings.general.title')}
            description={t('settings.general.description')}
          >
            <Row label={t('settings.general.version')}>
              <span className="font-mono text-sm text-foreground">
                {versionLoading ? '…' : (version ?? '—')}
              </span>
            </Row>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-muted">{t('settings.general.shortcuts')}</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {PRIMARY_SHORTCUTS.map((shortcut) => (
                  <li
                    key={shortcut.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{shortcut.description}</span>
                    <kbd className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted">
                      {shortcutDisplayLabel(shortcut.id)}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          </SettingsSection>

          <Separator />

          <SettingsSection
            title={t('settings.inventory.title')}
            description={t('settings.inventory.description')}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void onImport()}
              >
                <Upload className="size-3.5" />
                {busy === 'import'
                  ? t('settings.inventory.importing')
                  : t('settings.inventory.import')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void onExport()}
              >
                <Download className="size-3.5" />
                {busy === 'export'
                  ? t('settings.inventory.exporting')
                  : t('settings.inventory.export')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => setCsvSecretsOpen(true)}
              >
                <FileSpreadsheet className="size-3.5" />
                {busy === 'importCsv'
                  ? t('settings.inventory.importing')
                  : t('settings.inventory.importCsv')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => void onDownloadTemplate()}
              >
                <Download className="size-3.5" />
                {t('settings.inventory.downloadTemplate')}
              </Button>
            </div>
          </SettingsSection>

          <AlertDialog open={csvSecretsOpen} onOpenChange={setCsvSecretsOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.inventory.csvSecretsTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.inventory.csvSecretsDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel disabled={busy !== null}>Cancelar</AlertDialogCancel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void onImportCsv(false)}
                >
                  {t('settings.inventory.csvSecretsWithout')}
                </Button>
                <AlertDialogAction
                  disabled={busy !== null}
                  onClick={(event) => {
                    event.preventDefault()
                    void onImportCsv(true)
                  }}
                >
                  {t('settings.inventory.csvSecretsConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Separator />

          <SettingsSection
            title={t('settings.updates.title')}
            description={t('settings.updates.description')}
          >
            {updatesDisabled ? (
              <p className="mb-3 text-xs text-muted">{t('settings.updates.devNote')}</p>
            ) : null}
            {availableVersion ? (
              <p className="mb-3 text-sm text-foreground">
                {updateReady ? t('settings.updates.ready') : t('settings.updates.available')}{' '}
                <span className="font-mono text-accent">{availableVersion}</span>
              </p>
            ) : null}
            {updateDownloading && downloadProgress != null ? (
              <p className="mb-3 text-xs text-muted">
                {t('settings.updates.downloading', { percent: Math.round(downloadProgress) })}
              </p>
            ) : null}
            {updateStatus?.error ? (
              <p className="mb-3 text-xs text-destructive">{updateStatus.error}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null || updateChecking}
                onClick={() => void onCheckUpdates()}
              >
                <RefreshCw className="size-3.5" />
                {busy === 'check' || updateChecking
                  ? t('settings.updates.checking')
                  : t('settings.updates.check')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy !== null || !updateReady || updateDownloading}
                onClick={() => void onInstall()}
              >
                {busy === 'install'
                  ? t('settings.updates.restarting')
                  : updateDownloading
                    ? t('settings.updates.downloading', {
                        percent: downloadProgress != null ? Math.round(downloadProgress) : 0
                      })
                    : t('settings.updates.install')}
              </Button>
            </div>
          </SettingsSection>

          <Separator />

          <SettingsSection
            title={t('settings.help.title')}
            description={t('settings.help.description')}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/manual')}
            >
              <BookOpen className="size-3.5" />
              {t('settings.help.openManual')}
            </Button>
          </SettingsSection>

          <Separator />

          <SettingsSection
            title={t('settings.about.title')}
            description={t('settings.about.description')}
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t('settings.about.product')}</dt>
                <dd className="text-foreground">North</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t('settings.about.version')}</dt>
                <dd className="font-mono text-foreground">{version ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t('settings.about.repository')}</dt>
                <dd>
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    github.com/YanGraim/north
                    <ExternalLink className="size-3" />
                  </a>
                </dd>
              </div>
            </dl>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  )
}
