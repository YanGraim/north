# Plano — REC-005 Diretório e log a partir da seleção do terminal

- **Criado em:** 2026-10-31
- **Última atualização:** 2026-10-31
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `posixParent`, planos de diretório e de log, schema do classify + Vitest | shared | ✅ |
| 2 | `sessions:classify-path` no contrato, handler e preload; `stat` no `Client` SSH já aberto | shared / main / preload | ✅ |
| 3 | Itens no menu, confirmação, update parcial, `cd` e `log-follows:start`, i18n (3 locales) | renderer | ✅ |
| 4 | Manual `connect` (3 idiomas). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/lib/selection-path.ts` (novo) e `selection-path.test.ts`
- `src/shared/lib/startup-directory.ts` (`startupCdCommand`, `canonicalPosixDir`)
- `src/shared/lib/log-file.ts` (`normalizeLogFilePath`, `normalizeLogFileList`)
- `src/shared/ipc/channels.ts`, `contract.ts`
- `src/shared/protocols/driver.ts` — capacidade opcional de classificar path, só no SSH
- `src/main/protocols/ssh-driver.ts` (`SshProtocolSession`, SFTP curto)
- `src/main/services/protocol-manager.ts`
- `src/main/ipc/sessions.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/sessions/TerminalContextMenu.tsx`
- `src/renderer/src/features/sessions/TerminalView.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`

O manual entra na implementação. O what's new fica para o bump. Não há migration nem cenário Cypress: o harness não abre um terminal SSH com seleção.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Interpolar a seleção num `stat` ou num `cd` | Comando arbitrário no servidor | Normalizar nos dois lados, `stat` só no path aceito, `cd` com `startupCdCommand` |
| Chutar arquivo/diretório pela extensão | Arquivo sem ponto vira diretório, ou o contrário | `stat` no cliente já aberto. Sem SFTP, não grava |
| `useUpdateConnection` | Toast genérico “Conexão atualizada” junto do toast da ação | `connections.update` direto e invalidar as queries |
| Update com a conexão inteira desatualizada | Apaga `logFiles` ou outro campo | Mandar só `startupDirectory`, ou a lista completa de logs já montada |
| `cd` no meio de uma linha que a pessoa está digitando | O comando se mistura ao que está no prompt | A ideia pede o `cd` na sessão aberta. É uma escrita só, depois da confirmação, igual ao login do REC-002 |
| Seguir o `realpath` de um link | O diretório gravado não é o da seleção | `stat` segue o link só para o tipo. O path guardado é a seleção |
| Resolver `~` com o cwd do shell | `~/app` muda depois de um `cd` manual | `realpath('.')` do SFTP é o login, como no REC-002 |

## Notas de implementação

- Implementado em 2026-10-31. O `stat` é `SSH_FXP_STAT` no `Client` já aberto (segue link só para o tipo). `ENOENT` é o código SFTP 2. A mensagem do ssh2 não volta no IPC.
- Socket, fifo e outro tipo, na ação de diretório, não gravam. O toast é “não é um arquivo nem um diretório”, para não dizer que a conferência falhou.
- Se `log-follows:start` lança depois da lista gravada, o toast diz que o arquivo foi gravado e o quadro não abriu. Se o start devolve um código, o toast é o `connection.logFollow.errors.*` do REC-004.
- ADR não entra: sem dependência, sem porta nova, sem coluna, sem segredo no renderer. O canal só faz `stat` na sessão que o usuário já abriu.
- O menu fecha no `onSelect`. Estado do diálogo e da requisição fica no `TerminalView`.
- Ler `term.getSelection()` no clique.
- `absolute` do classify não passa por `realpath` do arquivo. Pai de arquivo é `posixParent` desse absoluto, e o valor persistido é `posixParent` da seleção (`~/app/file.log` → `~/app`).
- Sucesso do log: gravar a lista e só então `logFollows.start({ connectionId, logFileId })`. Se o start falhar, a lista já está salva; o toast usa o código que o REC-004 já traduz (`connection.logFollow.errors.*`).
