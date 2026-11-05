# Plano — REC-022 Equipes e acesso por conexão

- **Criado em:** 2026-11-05
- **Última atualização:** 2026-11-05
- **Homologação:** roteiro em `testes.md`
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Migration 008: tabelas `teams` e `team_members`; `project_grants` com equipe e conexão | server | ✅ |
| 2 | `AccessView` até a conexão; `listGrants` com as equipes | server | ✅ |
| 3 | Rotas de inventário e de segredos checam o acesso pela conexão | server | ✅ |
| 4 | `store/teams.ts`, rotas `/admin/teams`, grants por `teamId`, auditoria | server | ✅ |
| 5 | Sincronização de equipes pelos grupos do Entra no login | server | ✅ |
| 6 | `/me/access` com `connectionGrants` à parte | server | ✅ |
| 7 | `WorkspaceAccessSchema` e `permissionsFor` com conexão; `use-permissions` | shared/renderer | ✅ |
| 8 | Painel admin refeito (CSS, JS, fontes locais) | server/admin | ✅ |
| 9 | Vitest (servidor e desktop) e Playwright do painel | test | ✅ |
| 10 | Manual (Visão geral → Workspaces) e what's new 0.1.49 nos 3 idiomas | docs | ✅ |
| 11 | Atualizar o servidor da Locaweb com a imagem nova | deploy | ⬜ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `server/src/migrations.ts` (008)
- `server/src/access.ts`
- `server/src/store/grants.ts`
- `server/src/store/teams.ts`
- `server/src/routes/admin.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/inventory.ts`
- `server/src/routes/secrets.ts`
- `server/admin/admin.js`
- `server/admin/admin.css`
- `server/src/routes/admin-panel.ts`
- `src/shared/types/workspace-access.ts`
- `src/renderer/src/hooks/use-permissions.ts`

## Riscos

- **Desktop antigo × servidor novo:** coberto pelo `connectionGrants` à parte.
- **Desktop novo × servidor antigo:** coberto pelo `default([])`.
- **Migration 008 em produção:** recria `project_grants` numa transação. Fazer backup antes (`pg_dump`, ver `server/deploy/INSTALAR.md`).
- **`loadAccess` carrega o id de todas as conexões a cada requisição.** É barato no tamanho atual. Se o inventário crescer muito, vale cache por requisição ou uma consulta por caminho.
