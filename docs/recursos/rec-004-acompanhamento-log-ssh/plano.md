# Plano — REC-004 Acompanhamento de log na conexão SSH

- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `logFiles` no schema Zod (`.default([])`), `normalizeLogFilePath` / `buildTailFollowCommand` + Vitest | shared | ✅ |
| 2 | Migration `021` + repositório; North Server migration `007` + `CONNECTION_COLUMNS` / `JSON_COLUMNS` / `mapConnection` | main / server | ✅ |
| 3 | `LogFollowService`: ssh2, VPN, host key, `tail -F` citado, anel, dispose no quit | main | ✅ |
| 4 | IPC `log-follows:*` + `MessagePort`; janela auxiliar; fechar a principal no Windows/Linux ainda encerra o app | main / preload | ✅ |
| 5 | Formulário, detalhe, faixa no `AppShell`, rota do widget, i18n (3 locales) | renderer | ✅ |
| 6 | Export JSON, cópia de workspace, fixtures `Connection` e mock do e2e | main / test | ✅ |
| 7 | Manual `connect` (3 idiomas). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/types/connection.ts`
- `src/shared/lib/log-file.ts` (novo) e `log-file.test.ts`
- `src/shared/ipc/channels.ts`, `contract.ts`, `NorthApi`
- `src/main/database/migrations/021-connection-log-files.ts` e `migrations/index.ts`
- `src/main/database/migrations/migrations.test.ts` (`user_version` 20 → 21)
- `src/main/repositories/connections-repository.ts`
- `src/main/services/log-follow-service.ts` (novo)
- `src/main/protocols/ssh-auth.ts` (`buildSshConnectConfig`)
- `src/main/services/protocol-manager.ts` (host key e `vpnGate.ensure` reusáveis sem abrir sessão)
- `src/main/ipc/log-follows.ts` (novo) e o registro dos handlers
- `src/main/index.ts` (janela auxiliar, `close` da principal, `before-quit`)
- `src/main/window-theme.ts` (não aplicar overlay em janela sem overlay)
- `src/preload/index.ts`
- `server/src/migrations.ts`
- `server/src/store/inventory.ts`
- `src/main/services/inventory-json.ts`
- `src/main/workspaces/workspace-copy.ts`
- `src/renderer/src/App.tsx` (rota `#/log-follow/:followId` fora do shell)
- `src/renderer/src/components/layout/AppShell.tsx`
- `src/renderer/src/features/inventory/ConnectionFormDialog.tsx`
- `src/renderer/src/features/connections/ConnectionDetailsPanel.tsx`
- `src/renderer/src/features/sessions/` (quadro só leitura; não é aba de `SessionTabs`)
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`
- Fixtures que montam `Connection` por completo: `e2e-harness/mock-north.ts`, `src/main/database/seed-data.ts`, `src/renderer/src/features/navigation/group-tree-items.test.ts`, `src/main/protocols/ssh-auth.test.ts`, `src/main/services/protocol-manager.test.ts`, `src/shared/lib/startup-directory.test.ts`

O manual `connect` está nos 3 idiomas. O what's new continua para o bump seguinte a `0.1.46`. O roteiro está em `testes.md`.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Interpolar o path no `tail` | Comando arbitrário no servidor | Normalizar na borda, resolver `~` por SFTP, citar com `quotePosixArg`, prefixo fixo |
| Widget filho da janela principal | Minimizar a principal esconde o log | `BrowserWindow` sem `parent` |
| Widgets abertos seguram o processo | Fechar a principal no Windows deixa o app vivo | `app.quit` no close da principal, no mesmo caso em que hoje o app encerra |
| `setTitleBarOverlay` no widget | O tema quebra ao trocar claro/escuro | Moldura nativa; `paintWindows` só aplica overlay onde a janela foi criada com ele |
| Host key em paralelo com uma sessão | Dois prompts, ou auto-aceite | Reusar o pending de `known_hosts`; não usar o caminho dos workflows |
| Conteúdo de log em log do app ou no export | Segredo em disco | Não logar chunk; export leva a lista de paths, nunca o texto |
| Inventário remoto antigo sem a chave | `ConnectionSchema.parse` quebra a sync | `.default([])`; migration do server na mesma entrega |
| Nove SSH abertos | Carga e confusão | Teto de 8 follows; o serviço recusa com `LIMIT` |
| Arquivo some na rotação | O quadro congela | `tail -F` (nome + retry), não `tail -f` |

## Notas de implementação

- “Ao vivo” é um exec SSH, não um PTY. O comando não leva `\r`.
- SFTP auxiliar só para expandir `~` / `~/...` via `realpath('.')`. Não faz `stat` do arquivo: ele pode ainda não existir.
- O `tail` roda num pty (`xterm-256color`, stdin nunca é escrito). Sem pty o glibc segura a saída e o quadro fica vazio mesmo com o processo ao vivo.
- Os bytes vão por `log-follows:data` (o mesmo caminho do stdout do terminal). `MessagePort` neste app não entrega fluxo contínuo com `sandbox`.
- Ao abrir a janela auxiliar, a janela principal sem moldura no Windows perde a superfície. `wakeNativeWindows` reaplica o chrome e invalida o desenho.
- Fechar o widget pelo chrome do SO é **parar**, não recolher. Recolher é botão.
- O `followId` de runtime não é o `id` do arquivo. O par (conexão, id do arquivo) identifica o follow já aberto para o RF-08.
- Sem ADR além do 0019. O 0016 não muda de status.
