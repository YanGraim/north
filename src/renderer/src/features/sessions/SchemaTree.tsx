import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import type { DatabaseIntrospection } from '@shared/protocols'
import { ChevronDown, ChevronRight, Columns3, KeyRound, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { filterSchemaTree, firstFilteredTable } from './schema-tree-filter'

type SchemaTreeProps = {
  tree: DatabaseIntrospection | null
  loading: boolean
  selected?: { schema: string; table: string } | null
  onOpenTable: (schema: string, table: string) => void
}

export function SchemaTree({
  tree,
  loading,
  selected,
  onOpenTable
}: SchemaTreeProps): React.JSX.Element {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState('')

  const schemas = tree?.schemas ?? []
  const filterActive = filter.trim().length > 0
  const visibleSchemas = useMemo(() => filterSchemaTree(schemas, filter), [schemas, filter])
  const singleSchema = schemas.length === 1

  function toggle(key: string, currentlyOpen: boolean): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (currentlyOpen) {
        next.delete(key)
        next.add(`closed:${key}`)
      } else {
        next.delete(`closed:${key}`)
        next.add(key)
      }
      return next
    })
  }

  function isOpen(key: string, fallback = false): boolean {
    if (expanded.has(`closed:${key}`)) return false
    if (expanded.has(key)) return true
    return fallback
  }

  function openFirstMatch(): void {
    const match = firstFilteredTable(visibleSchemas)
    if (match) onOpenTable(match.schema, match.table)
  }

  if (loading && !tree) {
    return <p className="px-3 py-4 text-xs text-muted">{t('database.studio.loadingSchema')}</p>
  }

  if (!tree || schemas.length === 0) {
    return <p className="px-3 py-4 text-xs text-muted">{t('database.studio.emptySchema')}</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-2">
        <Input
          data-testid="schema-tree-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              openFirstMatch()
            }
          }}
          placeholder={t('database.studio.schemaFilterPlaceholder')}
          aria-label={t('database.studio.schemaFilterPlaceholder')}
          className="h-7 px-2 text-xs"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {visibleSchemas.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">{t('database.studio.schemaFilterEmpty')}</p>
        ) : (
          <ul className="space-y-0.5 p-2 text-[12px]">
            {visibleSchemas.map((schema) => {
              const schemaKey = `schema:${schema.name}`
              // While filtering, matching schemas stay expanded (plan: auto-expand).
              const open = filterActive || isOpen(schemaKey, singleSchema)
              return (
                <li key={schema.name}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-foreground hover:bg-surface-elevated"
                    onClick={() => {
                      if (filterActive) return
                      toggle(schemaKey, open)
                    }}
                  >
                    {open ? (
                      <ChevronDown className="size-3 shrink-0 text-muted" />
                    ) : (
                      <ChevronRight className="size-3 shrink-0 text-muted" />
                    )}
                    <span className="truncate font-medium">{schema.name}</span>
                  </button>
                  {open ? (
                    <ul className="ml-3 border-l border-border/60 pl-1">
                      {schema.tables.map((table) => {
                        const tableKey = `${schemaKey}:${table.name}`
                        const tableOpen = isOpen(tableKey)
                        const isSelected =
                          selected?.schema === schema.name && selected?.table === table.name
                        return (
                          <li key={table.name}>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                className="rounded-sm p-0.5 text-muted hover:bg-surface-elevated"
                                aria-label={t('database.studio.expandColumns')}
                                onClick={() => toggle(tableKey, tableOpen)}
                              >
                                {tableOpen ? (
                                  <ChevronDown className="size-3" />
                                ) : (
                                  <ChevronRight className="size-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                data-testid={`schema-table-${table.name}`}
                                className={cn(
                                  'flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1 py-0.5 text-left hover:bg-surface-elevated',
                                  isSelected ? 'bg-surface-elevated text-foreground' : ''
                                )}
                                onClick={() => onOpenTable(schema.name, table.name)}
                                title={t('database.studio.openTable')}
                              >
                                <Table2 className="size-3 shrink-0 text-muted" />
                                <span className="truncate">{table.name}</span>
                                <span className="shrink-0 text-[10px] uppercase text-muted">
                                  {table.type === 'view' ? 'view' : ''}
                                </span>
                              </button>
                            </div>
                            {tableOpen ? (
                              <ul className="ml-5 space-y-0.5 py-0.5">
                                {table.columns.map((column) => (
                                  <li
                                    key={column.name}
                                    className={cn(
                                      'flex items-center gap-1 px-1 py-0.5 text-muted',
                                      column.nullable ? '' : 'text-foreground'
                                    )}
                                  >
                                    {column.primaryKey ? (
                                      <KeyRound
                                        className="size-3 shrink-0 text-accent"
                                        aria-label="PK"
                                      />
                                    ) : (
                                      <Columns3 className="size-3 shrink-0" />
                                    )}
                                    <span className="truncate">{column.name}</span>
                                    <span className="truncate text-[10px] uppercase">
                                      {column.dataType}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
