import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/utils'
import type { ApiAuth, ApiHttpMethod, ApiKeyValue, ApiRequestDefinition } from '@shared/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { JsonEditor } from './JsonEditor'
import { KeyValueEditor } from './KeyValueEditor'

const METHODS: ApiHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

type EditorTab = 'params' | 'headers' | 'body' | 'auth'

type RequestEditorProps = {
  method: ApiHttpMethod
  url: string
  definition: ApiRequestDefinition
  urlInputRef?: React.RefObject<HTMLInputElement | null>
  onMethodChange: (method: ApiHttpMethod) => void
  onUrlChange: (url: string) => void
  onDefinitionChange: (definition: ApiRequestDefinition) => void
}

export function RequestEditor({
  method,
  url,
  definition,
  urlInputRef,
  onMethodChange,
  onUrlChange,
  onDefinitionChange
}: RequestEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<EditorTab>('params')

  function patch(next: Partial<ApiRequestDefinition>): void {
    onDefinitionChange({ ...definition, ...next })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5">
        <Select value={method} onValueChange={(value) => onMethodChange(value as ApiHttpMethod)}>
          <SelectTrigger className="h-7 w-[7.5rem] text-xs" data-testid="api-method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          ref={urlInputRef}
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder={t('api.studio.urlPlaceholder')}
          className="h-7 flex-1 font-mono text-xs"
          data-testid="api-url"
        />
      </div>
      <div className="flex shrink-0 items-center gap-1 px-2 py-1">
        {(
          [
            ['params', t('api.studio.params')],
            ['headers', t('api.studio.headers')],
            ['body', t('api.studio.body')],
            ['auth', t('api.studio.auth')]
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-xs',
              tab === id ? 'bg-surface-elevated text-foreground' : 'text-muted'
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Separator />
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {tab === 'params' ? (
          <KeyValueEditor
            items={definition.queryParams}
            onChange={(queryParams) => patch({ queryParams })}
          />
        ) : null}
        {tab === 'headers' ? (
          <KeyValueEditor items={definition.headers} onChange={(headers) => patch({ headers })} />
        ) : null}
        {tab === 'body' ? <BodyEditor definition={definition} onChange={patch} /> : null}
        {tab === 'auth' ? (
          <AuthEditor auth={definition.auth} onChange={(auth) => patch({ auth })} />
        ) : null}
      </div>
    </div>
  )
}

function BodyEditor({
  definition,
  onChange
}: {
  definition: ApiRequestDefinition
  onChange: (next: Partial<ApiRequestDefinition>) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const body = definition.body
  const type = body.type

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Select
        value={type}
        onValueChange={(value) => {
          if (value === 'none') onChange({ body: { type: 'none' } })
          else if (value === 'json')
            onChange({ body: { type: 'json', text: body.type === 'json' ? body.text : '{}' } })
          else if (value === 'text')
            onChange({ body: { type: 'text', text: body.type === 'text' ? body.text : '' } })
          else if (value === 'form-urlencoded')
            onChange({
              body: {
                type: 'form-urlencoded',
                fields: body.type === 'form-urlencoded' ? body.fields : []
              }
            })
          else
            onChange({
              body: { type: 'multipart', fields: body.type === 'multipart' ? body.fields : [] }
            })
        }}
      >
        <SelectTrigger className="h-7 w-48 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('api.studio.bodyNone')}</SelectItem>
          <SelectItem value="json">JSON</SelectItem>
          <SelectItem value="text">{t('api.studio.bodyText')}</SelectItem>
          <SelectItem value="form-urlencoded">x-www-form-urlencoded</SelectItem>
          <SelectItem value="multipart">multipart</SelectItem>
        </SelectContent>
      </Select>
      {body.type === 'json' ? (
        <div className="min-h-32 flex-1 rounded-md border border-border">
          <JsonEditor
            value={body.text}
            onChange={(text) => onChange({ body: { type: 'json', text } })}
          />
        </div>
      ) : null}
      {body.type === 'text' ? (
        <textarea
          value={body.text}
          onChange={(event) => onChange({ body: { type: 'text', text: event.target.value } })}
          className="min-h-32 flex-1 rounded-md border border-border bg-transparent p-2 font-mono text-xs"
        />
      ) : null}
      {body.type === 'form-urlencoded' || body.type === 'multipart' ? (
        <KeyValueEditor
          items={body.fields}
          onChange={(fields) => onChange({ body: { ...body, fields } })}
        />
      ) : null}
    </div>
  )
}

function AuthEditor({
  auth,
  onChange
}: {
  auth: ApiAuth | null
  onChange: (auth: ApiAuth | null) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const type = auth?.type ?? 'inherit'
  const current = auth

  return (
    <div className="space-y-3">
      <Select
        value={type}
        onValueChange={(value) => {
          if (value === 'inherit') onChange(null)
          else if (value === 'none') onChange({ type: 'none' })
          else if (value === 'bearer') onChange({ type: 'bearer', token: '{{token}}' })
          else if (value === 'basic')
            onChange({ type: 'basic', username: '{{username}}', password: '{{password}}' })
          else onChange({ type: 'apiKey', key: 'X-API-Key', value: '{{apiKey}}', in: 'header' })
        }}
      >
        <SelectTrigger className="h-7 w-48 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inherit">{t('api.studio.authInherit')}</SelectItem>
          <SelectItem value="none">{t('api.studio.authNone')}</SelectItem>
          <SelectItem value="bearer">Bearer</SelectItem>
          <SelectItem value="basic">Basic</SelectItem>
          <SelectItem value="apiKey">API Key</SelectItem>
        </SelectContent>
      </Select>
      {current?.type === 'bearer' ? (
        <Input
          value={current.token}
          onChange={(event) => onChange({ type: 'bearer', token: event.target.value })}
          placeholder="{{token}}"
          className="h-7 font-mono text-xs"
        />
      ) : null}
      {current?.type === 'basic' ? (
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={current.username}
            onChange={(event) => onChange({ ...current, username: event.target.value })}
            placeholder="{{username}}"
            className="h-7 font-mono text-xs"
          />
          <Input
            value={current.password}
            onChange={(event) => onChange({ ...current, password: event.target.value })}
            placeholder="{{password}}"
            className="h-7 font-mono text-xs"
          />
        </div>
      ) : null}
      {current?.type === 'apiKey' ? (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={current.key}
            onChange={(event) => onChange({ ...current, key: event.target.value })}
            placeholder={t('api.studio.key')}
            className="h-7 text-xs"
          />
          <Input
            value={current.value}
            onChange={(event) => onChange({ ...current, value: event.target.value })}
            placeholder="{{apiKey}}"
            className="h-7 font-mono text-xs"
          />
          <Select
            value={current.in}
            onValueChange={(value) => onChange({ ...current, in: value as 'header' | 'query' })}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">{t('api.studio.headers')}</SelectItem>
              <SelectItem value="query">{t('api.studio.params')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

export type { ApiKeyValue }
