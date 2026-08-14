import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { DetailSection } from '@renderer/features/connections/DetailSection'
import {
  useConnectionSecrets,
  useDeleteConnectionSecret,
  useSetConnectionSecret
} from '@renderer/hooks/use-workflows'
import { WORKFLOW_SECRET_KINDS } from '@shared/types'
import { KeyRound, Trash2 } from 'lucide-react'
import { useState } from 'react'

type ConnectionSecretsSectionProps = {
  connectionId: string
}

const SECRET_FIELDS = [
  { kind: WORKFLOW_SECRET_KINDS.gitUsername, label: 'Usuário Git', placeholder: 'git user' },
  {
    kind: WORKFLOW_SECRET_KINDS.git,
    label: 'Senha Git',
    placeholder: 'git password',
    password: true
  },
  {
    kind: WORKFLOW_SECRET_KINDS.sudo,
    label: 'Senha sudo',
    placeholder: 'sudo password',
    password: true
  }
] as const

export function ConnectionSecretsSection({
  connectionId
}: ConnectionSecretsSectionProps): React.JSX.Element {
  const { data: secrets = [] } = useConnectionSecrets(connectionId)
  const setSecret = useSetConnectionSecret()
  const deleteSecret = useDeleteConnectionSecret()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  function kindDefined(kind: string): boolean {
    return secrets.some((s) => s.kind === kind)
  }

  return (
    <DetailSection title="Secrets">
      <div className="space-y-3" data-testid="connection-secrets-section">
        <p className="text-xs text-muted">
          Opcionais. Use só se um workflow marcar Git/Sudo em Credenciais.
        </p>
        {SECRET_FIELDS.map((field) => {
          const defined = kindDefined(field.kind)
          return (
            <div key={field.kind} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`secret-${field.kind}`}>{field.label}</Label>
                {defined ? (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <KeyRound className="size-3" />
                    Definido (vault)
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={`Remover ${field.label}`}
                      data-testid={`connection-secret-delete-${field.kind}`}
                      onClick={() =>
                        void deleteSecret.mutateAsync({
                          connectionId,
                          kind: field.kind
                        })
                      }
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Input
                  id={`secret-${field.kind}`}
                  type={'password' in field && field.password ? 'password' : 'text'}
                  placeholder={defined ? '••••••••' : field.placeholder}
                  value={drafts[field.kind] ?? ''}
                  data-testid={`connection-secret-value-${field.kind}`}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [field.kind]: e.target.value }))}
                />
                <Button
                  type="button"
                  size="sm"
                  data-testid={`connection-secret-save-${field.kind}`}
                  disabled={!drafts[field.kind]}
                  onClick={() => {
                    const secret = drafts[field.kind]
                    if (!secret) return
                    void setSecret
                      .mutateAsync({
                        connectionId,
                        kind: field.kind,
                        secret
                      })
                      .then(() =>
                        setDrafts((prev) => {
                          const next = { ...prev }
                          delete next[field.kind]
                          return next
                        })
                      )
                  }}
                >
                  Salvar
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </DetailSection>
  )
}
