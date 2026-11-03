# Plano — REC-008 Monitorar log da seleção

- **Criado em:** 2026-10-31
- **Última atualização:** 2026-11-02
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Input `{ connectionId, path }`, snapshot com `ephemeral` e `logFileId` nulo, `INVALID_PATH`, `startPath` e a contagem só dos gravados + Vitest | shared / main | ✅ |
| 2 | Handler de `log-follows:start` encaminha o path; preload acompanha o tipo | main / preload | ✅ |
| 3 | Item no menu, início pelo path, toasts, i18n (3 locales) | renderer | ✅ |
| 4 | Manual `connect` (3 idiomas). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/types/log-follow.ts` (`LogFollowStartInput`, snapshot, `INVALID_PATH`)
- `src/shared/lib/log-file.ts` (`normalizeLogFilePath`, `LOG_FOLLOW_LIMIT`, `buildTailFollowCommand`)
- `src/main/services/log-follow-service.ts` e `log-follow-service.test.ts`
- `src/main/ipc/log-follows.ts`
- `src/preload/index.ts` (o `start` já repassa o input; o tipo vem do contrato)
- `src/shared/ipc/contract.ts` (o `start` já está em `IpcInvokeMap` e em `NorthApi`)
- `src/renderer/src/features/sessions/TerminalContextMenu.tsx`
- `src/renderer/src/features/sessions/TerminalView.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`

O manual entra na implementação. O what's new fica para o bump. Não há migration nem cenário Cypress: o harness não abre um terminal SSH com seleção.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Interpolar a seleção no `tail` | Comando arbitrário no servidor | `normalizeLogFilePath` nos dois lados e o `buildTailFollowCommand` que já cita o absoluto |
| Contar o quadro efêmero no teto de 8 | A seleção passa a esbarrar no limite que a ideia tirou | Contar só `ephemeral === false`. Teste com 8 gravados e um path |
| `retry` procura `logFileId` em `logFiles` | O quadro da seleção morre ao tentar de novo | Ramo efêmero usa o path que está na memória |
| Dois `tail` do mesmo path | Dois SSH para o mesmo arquivo | Os dois inícios focam o quadro já aberto da mesma conexão e do mesmo path normalizado |
| `start` por path grava a conexão | O arquivo entra na lista sem o usuário pedir | `startPath` não chama update. O renderer também não |
| Tratar `~/app.log` e o absoluto como o mesmo arquivo | O clique foca o quadro errado, ou deixa de abrir | Igualdade é a string normalizada, a mesma do path gravado |

## Notas de implementação

- ADR não entra: sem dependência, sem porta nova, sem coluna, sem segredo no renderer. O canal e o `tail` citado já estão no ADR 0019. O quadro efêmero não entra no export.
- O menu fecha no `onSelect`. Ler `term.getSelection()` no clique, como nas ações do REC-005.
- `INVALID_PATH` volta no resultado do invoke. O quadro só nasce depois que o path foi aceito e a conexão é SSH.
- O texto de `LIMIT` (“até 8 arquivos ao mesmo tempo”) continua certo: esse teto é o dos quadros gravados.
- Homologação em 2026-11-02. Com ligaturas ligadas, o quadro exigiu `allowProposedApi` no xterm ([BUG-004](../../correcoes.md)).
