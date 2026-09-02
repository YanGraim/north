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
import { Switch } from '@renderer/components/ui/switch'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import type {
  DatabaseCellValue,
  DatabaseExportFormat,
  DatabaseExportOptions,
  DatabaseQueryColumn,
  SqlStudioEngine
} from '@shared/protocols'
import { FileSpreadsheet, FileText, Table2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type DatabaseExportContext = {
  sessionId: string
  engine: SqlStudioEngine
  fullQuerySql: string
  suggestedName: string
  defaultSqlTableName: string
}

export type GridExportSnapshot = {
  hasSelection: boolean
  selection: {
    columns: DatabaseQueryColumn[]
    rows: Array<Record<string, DatabaseCellValue>>
  } | null
  visible: {
    columns: DatabaseQueryColumn[]
    rows: Array<Record<string, DatabaseCellValue>>
  }
}

type ExportSource = 'selection' | 'visible' | 'query'

type ExportResultDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: DatabaseExportContext
  snapshot: GridExportSnapshot | null
}

const FORMATS: Array<{
  id: DatabaseExportFormat
  labelKey: string
  ext: string
}> = [
  { id: 'csv', labelKey: 'Csv', ext: '.csv' },
  { id: 'json', labelKey: 'Json', ext: '.json' },
  { id: 'xlsx', labelKey: 'Xlsx', ext: '.xlsx' },
  { id: 'pdf', labelKey: 'Pdf', ext: '.pdf' },
  { id: 'sql', labelKey: 'Sql', ext: '.sql' }
]

export function ExportResultDialog({
  open,
  onOpenChange,
  context,
  snapshot
}: ExportResultDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const hasSelection = snapshot?.hasSelection ?? false
  const selectionCount = snapshot?.selection?.rows.length ?? 0
  const visibleCount = snapshot?.visible.rows.length ?? 0
  const [source, setSource] = useState<ExportSource>(hasSelection ? 'selection' : 'query')
  const [format, setFormat] = useState<DatabaseExportFormat>('csv')
  const [busy, setBusy] = useState(false)
  const [csvHeader, setCsvHeader] = useState(true)
  const [csvDelimiter, setCsvDelimiter] = useState<',' | ';'>(',')
  const [csvBom, setCsvBom] = useState(true)
  const [xlsxHeader, setXlsxHeader] = useState(true)
  const [xlsxSheetName, setXlsxSheetName] = useState('Sheet1')
  const [pdfLandscape, setPdfLandscape] = useState(true)
  const [pdfHeader, setPdfHeader] = useState(true)
  const [sqlTableName, setSqlTableName] = useState(context.defaultSqlTableName)

  useEffect(() => {
    if (!open) return
    setSource(hasSelection ? 'selection' : visibleCount > 0 ? 'visible' : 'query')
    setFormat('csv')
    setSqlTableName(context.defaultSqlTableName)
  }, [context.defaultSqlTableName, hasSelection, open, visibleCount])

  const sourceOptions = useMemo(
    () =>
      [
        {
          id: 'selection' as const,
          title: t('database.studio.exportSourceSelection'),
          hint: t('database.studio.exportSourceSelectionHint'),
          count: selectionCount,
          disabled: !hasSelection
        },
        {
          id: 'visible' as const,
          title: t('database.studio.exportSourceVisible'),
          hint: t('database.studio.exportSourceVisibleHint'),
          count: visibleCount,
          disabled: visibleCount === 0
        },
        {
          id: 'query' as const,
          title: t('database.studio.exportSourceQuery'),
          hint: t('database.studio.exportSourceQueryHint'),
          count: null,
          disabled: false
        }
      ] satisfies Array<{
        id: ExportSource
        title: string
        hint: string
        count: number | null
        disabled: boolean
      }>,
    [hasSelection, selectionCount, t, visibleCount]
  )

  function buildOptions(): DatabaseExportOptions {
    return {
      csvHeader,
      csvDelimiter,
      csvBom,
      xlsxHeader,
      xlsxSheetName,
      pdfLandscape,
      pdfHeader,
      sqlTableName
    }
  }

  async function handleExport(): Promise<void> {
    if (!snapshot) return
    setBusy(true)
    try {
      const options = buildOptions()
      const suggestedName = context.suggestedName
      let result: Awaited<ReturnType<typeof window.north.db.export>>

      if (source === 'query') {
        result = await window.north.db.export({
          source: 'query',
          sessionId: context.sessionId,
          sql: context.fullQuerySql,
          format,
          options,
          suggestedName
        })
      } else {
        const payload = source === 'selection' ? snapshot.selection : { ...snapshot.visible }
        if (!payload || payload.rows.length === 0) return
        result = await window.north.db.export({
          source: 'rows',
          columns: payload.columns,
          rows: payload.rows,
          format,
          options,
          suggestedName,
          engine: format === 'sql' ? context.engine : undefined
        })
      }

      if (result.canceled) {
        onOpenChange(false)
        return
      }

      onOpenChange(false)
      toastSuccess(
        result.truncated
          ? t('database.studio.exportDoneTruncated', { count: result.rowCount })
          : t('database.studio.exportDone', { count: result.rowCount })
      )
    } catch (error) {
      toastError(error, t('database.studio.exportError'))
    } finally {
      setBusy(false)
    }
  }

  const canExport =
    snapshot != null &&
    (source === 'query' ||
      (source === 'visible' && snapshot.visible.rows.length > 0) ||
      (source === 'selection' && snapshot.selection != null && snapshot.selection.rows.length > 0))

  const showFormatOptions = format !== 'json'
  const formatLabel = t(
    `database.studio.exportFormat${format.charAt(0).toUpperCase()}${format.slice(1)}`
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        data-testid="export-result-dialog"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleExport()
          }}
        >
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-muted" aria-hidden />
              {t('database.studio.exportTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('database.studio.exportDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-4 py-4">
            <section className="grid gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                {t('database.studio.exportSource')}
              </p>
              <div className="grid gap-1.5">
                {sourceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={source === option.id}
                    disabled={option.disabled}
                    data-testid={`export-source-${option.id}`}
                    className={cn(
                      'flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                      source === option.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-border/80 hover:bg-surface-elevated/60',
                      option.disabled && 'cursor-not-allowed opacity-45'
                    )}
                    onClick={() => {
                      if (option.disabled) return
                      setSource(option.id)
                    }}
                  >
                    <span
                      className={cn(
                        'mt-0.5 size-3.5 shrink-0 rounded-full border',
                        source === option.id
                          ? 'border-accent bg-accent'
                          : 'border-muted bg-transparent'
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{option.title}</span>
                        {option.count != null ? (
                          <span className="shrink-0 tabular-nums text-[11px] text-muted">
                            {t('database.studio.exportRowCount', { count: option.count })}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                {t('database.studio.exportFormat')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map((item) => {
                  const active = format === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      data-testid={`export-format-${item.id}`}
                      className={cn(
                        'rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                        active
                          ? 'border-accent bg-accent/10 text-foreground'
                          : 'border-border text-muted hover:border-border/80 hover:bg-surface-elevated/60 hover:text-foreground'
                      )}
                      onClick={() => setFormat(item.id)}
                    >
                      {t(`database.studio.exportFormat${item.labelKey}`)}
                      <span className="ml-1 text-[10px] text-muted">{item.ext}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {showFormatOptions ? (
              <section className="grid gap-3 rounded-md border border-border bg-surface-elevated/40 p-3">
                <p className="text-[11px] font-medium text-muted">
                  {t('database.studio.exportFormatOptions', { format: formatLabel })}
                </p>

                {format === 'csv' ? (
                  <>
                    <OptionRow
                      label={t('database.studio.exportCsvHeader')}
                      control={<Switch checked={csvHeader} onCheckedChange={setCsvHeader} />}
                    />
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted">
                        {t('database.studio.exportCsvDelimiter')}
                      </Label>
                      <div className="inline-flex rounded-md border border-border p-0.5">
                        {(
                          [
                            [',', t('database.studio.exportCsvComma')] as const,
                            [';', t('database.studio.exportCsvSemicolon')] as const
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={cn(
                              'rounded px-2.5 py-1 text-xs transition-colors',
                              csvDelimiter === value
                                ? 'bg-accent/15 text-foreground'
                                : 'text-muted hover:text-foreground'
                            )}
                            onClick={() => setCsvDelimiter(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <OptionRow
                      label={t('database.studio.exportCsvBom')}
                      hint={t('database.studio.exportCsvBomHint')}
                      control={<Switch checked={csvBom} onCheckedChange={setCsvBom} />}
                    />
                  </>
                ) : null}

                {format === 'xlsx' ? (
                  <>
                    <OptionRow
                      label={t('database.studio.exportXlsxHeader')}
                      control={<Switch checked={xlsxHeader} onCheckedChange={setXlsxHeader} />}
                    />
                    <div className="grid gap-1.5">
                      <Label htmlFor="export-xlsx-sheet" className="text-xs text-muted">
                        {t('database.studio.exportXlsxSheet')}
                      </Label>
                      <Input
                        id="export-xlsx-sheet"
                        value={xlsxSheetName}
                        onChange={(event) => setXlsxSheetName(event.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </>
                ) : null}

                {format === 'pdf' ? (
                  <>
                    <OptionRow
                      label={t('database.studio.exportPdfLandscape')}
                      control={<Switch checked={pdfLandscape} onCheckedChange={setPdfLandscape} />}
                    />
                    <OptionRow
                      label={t('database.studio.exportPdfHeader')}
                      control={<Switch checked={pdfHeader} onCheckedChange={setPdfHeader} />}
                    />
                    {source === 'query' ? (
                      <p className="text-[11px] text-muted">
                        {t('database.studio.exportPdfLimitHint')}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {format === 'sql' ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="export-sql-table" className="text-xs text-muted">
                      {t('database.studio.exportSqlTable')}
                    </Label>
                    <Input
                      id="export-sql-table"
                      value={sqlTableName}
                      onChange={(event) => setSqlTableName(event.target.value)}
                      className="h-8 font-mono text-sm"
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            {source === 'query' && format !== 'pdf' ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <Table2 className="size-3 shrink-0" aria-hidden />
                {t('database.studio.exportQueryLimitHint')}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border bg-surface-elevated/30 px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canExport || busy}
              data-testid="export-confirm"
            >
              <FileText className="size-3.5" aria-hidden />
              {t('database.studio.exportConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OptionRow({
  label,
  hint,
  control
}: {
  label: string
  hint?: string
  control: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
      </div>
      {control}
    </div>
  )
}
