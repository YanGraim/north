# Plano — REC-024 Workflows na organização

- **Última atualização:** 2026-11-06

## Servidor (0.4.0)

- Migration `010-workflows`: `workflows`, `group_variables`, `environment_updates` (com `user_id`, `workflow_run_id` sem FK: o run é local).
- `server/src/store/workflows.ts` e `server/src/routes/workflows.ts`: `/api/v1/workflows`, `/group-variables`, `/environment-updates`. Regra: `AccessView.canUse('group')` (concedido no grupo ou acima, não só caminho).
- `events.ts`: entidades `workflow`, `variable`, `update` no `inventory.changed`.
- `/me/access` com `teams`.
- Painel admin: `grantPicker` com caixas de seleção, `descendantsOf` para não mandar o que o pai já cobre; correção do `null` na página da equipe.

## Desktop

- `src/main/workspaces/workflow-store.ts`: `WorkflowStore` local (SQLite) e remoto (`RemoteWorkflowStore`), exposto por `WorkspaceRegistry.workflows()`.
- Migration local `024-organization-workflow-runs`: `organization_workflow_runs` e `organization_connection_secrets`, sem FKs; repositórios parametrizados por tabela e marcados como do computador.
- `WorkflowService` lê de um `WorkflowScope` do workspace ativo; VPN via `ProtocolManager.prepareFollowVpn` / `releaseFollowVpn`.
- `WorkflowEngine`: falha ao abrir a sessão vira run `failed`.
- `workspace-copy.ts`: copia variáveis e workflows do grupo.
- UI: "por Fulano" em `UpdateRow`, seção "Você em …" em Configurações, `useCanEditGroup` esconde edição para Visualizador.
- Manual (`workflows.md`, `overview.md`) e what's new 0.1.52 nos 3 idiomas.
