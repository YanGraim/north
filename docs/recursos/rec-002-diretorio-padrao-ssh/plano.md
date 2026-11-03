# Plano — REC-002 Diretório padrão na conexão SSH

- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `startupDirectory` no schema Zod (`.default(null)`) e `normalizeStartupDirectory` / `quotePosixArg` + Vitest | shared | ✅ |
| 2 | Migration `020` + repositório; North Server migration `006` + `CONNECTION_COLUMNS` / `mapConnection` | main / server | ✅ |
| 3 | `SshDriver`: stat via SFTP curto, `cd` citado só se o diretório existir, `session.notice` no fallback | main | ✅ |
| 4 | Formulário SSH, detalhe da conexão, toast do SFTP em `FileBrowserView` | renderer | ✅ |
| 5 | Export JSON, cópia de workspace, fixtures `Connection` e mock do e2e | main / test | ✅ |
| 6 | Manual `connect` (3 idiomas). What's new no bump da próxima versão | docs | 🔄 |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/types/connection.ts`
- `src/shared/lib/startup-directory.ts` (novo) e `startup-directory.test.ts`
- `src/main/database/migrations/020-connection-startup-directory.ts`
- `src/main/database/migrations/index.ts`
- `src/main/database/migrations/migrations.test.ts` (`user_version` 19 → 20)
- `src/main/repositories/connections-repository.ts`
- `src/main/protocols/ssh-driver.ts`
- `server/src/migrations.ts`
- `server/src/store/inventory.ts`
- `src/main/services/inventory-json.ts`
- `src/main/workspaces/workspace-copy.ts`
- `src/renderer/src/features/inventory/ConnectionFormDialog.tsx`
- `src/renderer/src/features/connections/ConnectionDetailsPanel.tsx`
- `src/renderer/src/features/sessions/SessionView.tsx` (repassar `connectionId`)
- `src/renderer/src/features/sessions/FileBrowserView.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`
- Fixtures que montam `Connection` por completo: `e2e-harness/mock-north.ts`, `src/main/database/seed-data.ts`, `src/renderer/src/features/navigation/group-tree-items.test.ts`, `src/main/protocols/ssh-auth.test.ts`, `src/main/services/protocol-manager.test.ts`

O manual do capítulo `connect` está nos 3 idiomas. O what's new entra no bump da próxima versão. O roteiro está em `testes.md`.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Interpolar o path no `cd` | Comando arbitrário no servidor | Normalizar na borda, resolver `~` fora do shell, citar com `quotePosixArg`, não escrever o `cd` quando o stat falha |
| `cd` antes do shell ler o PTY, misturado ao MOTD | A linha aparece cedo ou ecoa no terminal | Escrever só depois do canal do shell aberto; o eco do `cd` é aceitável |
| Servidor sem subsistema SFTP | O stat não roda e um aviso de “pasta inexistente” seria mentira | Nesse caso, `cd` citado sem aviso do North; o shell reporta o erro dele |
| `fs.home` passar a devolver o diretório inicial | O botão home deixa de ir para o login | Home segue `realpath('.')`; só a pasta inicial do painel muda |
| Inventário remoto antigo sem a chave | `ConnectionSchema.parse` quebra a sync | `.default(null)` no schema; a migration do server entra na mesma entrega |
| Campo preenchido em conexão que deixou de ser SSH | `cd` ou list num protocolo que não usa isso | O formulário só mostra em SSH e o save limpa o valor nos outros |

## Notas de implementação

- “Diretório de login” é o cwd com que a sessão já abre hoje (home do shell / `realpath('.')` do SFTP), não um `/home/$USER` forçado.
- Preflight do terminal: `client.sftp` → `realpath('.')` para expandir `~` → `stat`. Diretório ok: `stream.write`. Senão: `notice` e nenhum byte de `cd`. Fechar o SFTP auxiliar em seguida.
- Forma do comando: `cd -- ` + `quotePosixArg(absoluto)` + `\r` (Enter do PTY, não `\n`).
- O navegador de arquivos decide a pasta uma vez, quando `remotePath` ainda está vazio, para uma edição posterior da conexão não mover a sessão aberta.
- Sem canal IPC novo e sem ADR: coluna nullable no mesmo padrão de `default_command` e `agent_forward`.
- O CSV de inventário não ganhou coluna. Quem importa CSV continua gravando `null`.
