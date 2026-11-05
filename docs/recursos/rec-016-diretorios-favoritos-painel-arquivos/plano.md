# Plano — REC-016 Diretórios favoritos no painel de arquivos

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Migration `022` e a tabela fora de `connections` | main | ✅ |
| 2 | Repositório: listar, acrescentar, remover | main | ✅ |
| 3 | Canais IPC, contrato, handler e preload | shared / main / preload | ✅ |
| 4 | Menu no painel remoto | renderer | ✅ |
| 5 | Rótulos nos 3 locales | renderer | ✅ |
| 6 | Vitest do repositório e da ausência no export; Cypress do navegador se o harness abrir o painel | test | ✅ |
| 7 | Manual (`connect`) nos 3 locales. What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/main/database/migrations/022-connection-directory-favorites.ts`
- `src/main/database/migrations/index.ts`
- `src/main/database/migrations/migrations.test.ts`
- `src/main/repositories/connections-repository.ts` (ou repositório ao lado; `duplicate` não copia a lista)
- `src/main/services/inventory-json.ts` (não ler a tabela)
- `src/main/workspaces/workspace-copy.ts` (não copiar a lista)
- `src/shared/ipc/channels.ts`, `src/shared/ipc/contract.ts`
- `src/main/ipc/connections.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/sessions/file-browser/FilePane.tsx`
- `src/renderer/src/features/sessions/FileBrowserView.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Gravar o caminho na linha de `connections` | Export, duplicata e cópia de workspace levam a lista | Tabela própria, fora do objeto `Connection` que esses três já copiam |
| Confundir com a estrela de conexão favorita | O inventário ganha ou perde um favorito de conexão | Canais novos; o botão não chama `connections:toggle-favorite` |
| `changePath` antes de saber se a pasta existe | A barra fica num caminho que não abre | `source.list` primeiro; `changePath` só no sucesso |
| O espelho ou o painel local mostrar o menu | Favorito numa superfície que a ideia deixou de fora | Botão só no remoto com `connectionId` e com `mirror` falso |
| `/var/www/` e `/var/www` virarem duas linhas | A lista mente que são pastas diferentes | Comparar e gravar o valor de `normalizeStartupDirectory` |

## Notas de implementação

Sem ADR: a tabela nova não entra no import/export e não migra dado antigo. O critério da skill `nova-adr` para schema é impacto em import/export ou migração de dados já existentes. O [REC-002](../rec-002-diretorio-padrao-ssh/especificacao.md) continua dono de `startup_directory`; este recurso não escreve nessa coluna.

A foreign key ficou de fora. Uma conexão de organização não é linha do SQLite pessoal; a chave impediria gravar o favorito nela. O trigger cobre o delete da conexão local, inclusive quando some junto com o cliente ou o grupo. O handler de delete apaga pelo id também, para a conexão que só existe no servidor.
