# Plano — REC-023 Acessos e VPN na organização

- **Criado em:** 2026-11-05
- **Última atualização:** 2026-11-05
- **Homologação:** roteiro em `testes.md`
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Migration 009: `vpns`, `vpn_id`, `accesses`, tags, favoritos, `project_grants` com acesso | server | ✅ |
| 2 | `AccessView` com acesso; `store/accesses.ts`, `store/vpns.ts`; rotas | server | ✅ |
| 3 | Segredos com dono conexão ou acesso; `accessGrants` em `/me/access` | server | ✅ |
| 4 | `InventoryStore.accesses`; IPC de acessos, teste de banco, busca e CSV pelo workspace ativo | main | ✅ |
| 5 | `OrganizationVpnBridge`, migration 023 e repositórios de VPN da máquina | main | ✅ |
| 6 | VPN por sessão na organização (conexão e acesso) e vínculo de cliente/ambiente | main | ✅ |
| 7 | Cópia entre workspaces com acessos e VPN; "Copiar do Meu workspace…" | main/renderer | ✅ |
| 8 | Painel admin: acessos na árvore e liberação de um acesso | server/admin | ✅ |
| 9 | Vitest (servidor e desktop) e Playwright do painel | test | ✅ |
| 10 | Manual (Visão geral e VPNs) e what's new 0.1.51 nos 3 idiomas | docs | ✅ |
| 11 | Atualizar o servidor da Locaweb com a imagem nova | deploy | ⬜ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `server/src/migrations.ts` (009), `server/src/store/accesses.ts`, `server/src/store/vpns.ts`, `server/src/routes/inventory.ts`
- `src/main/workspaces/organization-vpns.ts`, `src/main/workspaces/workspace-registry.ts`, `src/main/workspaces/workspace-copy.ts`
- `src/main/database/migrations/023-organization-vpn-links.ts`
- `src/renderer/src/features/workspaces/CopyFromPersonalDialog.tsx`
