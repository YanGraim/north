# ADR 0014 — Sistema de Workflows

- **Status:** Aceito
- **Data:** 2026-08-01

## Contexto

O inventário e as sessões in-app cobrem “conectar e operar”. Falta um caminho estruturado para **ações repetíveis** sobre uma conexão (deploy, restart, health-check) sem scripts soltos nem sair do North. A RFC de Workflows congelou o contrato; este ADR registra as decisões de produto e arquitetura.

## Decisão

1. **Dono = Group** — Workflows e `GroupVariable` (config plaintext) pertencem ao grupo. Execução sempre com `targets[]` (MVP: 1 conexão SSH). Credenciais **nunca** no workflow nem nas variáveis de grupo.
2. **Entrada híbrida (MVP)** — seção Workflows no painel da conexão; split do botão Conectar; Command Palette (`Executar workflow…`). Gestão no hub do grupo (dialog). Sem item na sidebar global.
3. **Run com snapshot** — `WorkflowRun` grava `definitionSnapshot`, `variablesSnapshot` e `inputValues` no start. Histórico não depende do HEAD do workflow.
4. **Definition versionada** — `schemaVersion: 1` com `inputs[]` + `steps[]`. Steps MVP: `ssh.exec`, `delay`, `confirm`, `set.variable`, `script`. Envelope com `StepPolicy` (`timeoutMs`, `onFailure`, `requiresConfirmation`; `retryPolicy` reservado).
5. **Engine linear** — estágio puro `resolve` → `execute` | `preview`. `RunMode`: `live` | `dry-run`. Um **client SSH por target por run** via `RemoteExecService` (`ssh2.exec`, não PTY da sessão interativa). CWD **não** persiste entre steps.
6. **Aba `workflow-run`** — tab de workspace tipada (não `ProtocolDriver`). UI MVP: timeline, progresso, log por step, Retry / Continue / Cancelar em falha (`onFailure: ask`).
7. **Interpolação** — sintaxe `{{KEY}}`; precedência grupo → defaults de inputs → valores do run → `set.variable`. Namespaces (`{{group.KEY}}`) reservados como evolução compatível.
8. **Secrets na conexão** — bolsa `connection_secrets (connection_id, kind, credential_ref)`; migração do `credentialRef` atual. Estratégias `prompt` | `vault(kind)` | `none` + learn-to-save. Zero secrets em definition/vars/snapshots.
9. **Testes** — Vitest (interpolação, policy, engine, migrations, repos, RemoteExec mock) + Cypress E2E (UI com IPC/exec mockados).

## Consequências

- Export/template futuro = definition + keys de variáveis, sem secrets nem IDs locais de conexão.
- Multi-target, scheduler, conditions/loops exigem bump de `schemaVersion` ou fan-out no engine; runs antigos permanecem imutáveis.
- Heurística de prompt sudo/git fica conservadora no MVP (`authHint` / pause `auth`); wrappers explícitos depois.
- Logs de step em `userData/workflow-logs/{runId}/`; SQLite só metadados.
