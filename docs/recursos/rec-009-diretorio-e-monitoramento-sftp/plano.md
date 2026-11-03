# Plano — REC-009 Diretório padrão e monitoramento no painel SFTP

- **Criado em:** 2026-11-02
- **Última atualização:** 2026-11-02
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `planStartupDirectoryFromPane` + Vitest | shared | ✅ |
| 2 | Botão, confirmação, update parcial de `startupDirectory` e dos `logFiles`, início do quadro gravado e do quadro pelo path, i18n (3 locales) | renderer | ✅ |
| 3 | O painel FTP do Cypress não mostra o botão nem os itens | test | ✅ |
| 4 | Manual `connect` (3 idiomas). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/lib/selection-path.ts` e `selection-path.test.ts` (`planStartupDirectoryFromPane`)
- `src/shared/lib/startup-directory.ts` (`normalizeStartupDirectory`)
- `src/shared/lib/log-file.ts` (`planLogFileFromSelection` já cobre duplicata e teto)
- `src/renderer/src/features/sessions/FileBrowserView.tsx`
- `src/renderer/src/features/sessions/file-browser/FilePane.tsx`
- `src/renderer/src/features/sessions/TerminalView.tsx` (o diálogo e o update parcial a reusar, sem extrair se o custo passar do copiar o trecho curto)
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`
- `cypress/e2e/ftp/file-browser.cy.ts` (o FTP não ganha as ações)

Não há canal IPC, preload, migration nem serviço novo. O `connections.update` e o `log-follows:start` já existem. O manual entra na implementação. O what's new fica para o bump.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Update com a conexão inteira | Apaga `logFiles` ou outro campo | Mandar só `startupDirectory`, ou a lista completa de logs já montada por `planLogFileFromSelection` |
| `useUpdateConnection` | Toast genérico “Conexão atualizada” junto do toast da ação | `connections.update` direto e invalidar as queries |
| Gravar o rascunho do campo de caminho | A pasta salva não é a que está na tela | Usar o `path` listado, não o `pathDraft` |
| Tratar link ou pasta como arquivo de log | Um diretório entra em `logFiles` | Itens indisponíveis salvo `type === 'file'` e um único selecionado. O plano de log também exige `kind: 'file'` |
| Reimplementar o teto de 8 ou o foco do quadro | O ao vivo passa a ocupar vaga, ou abre um segundo `tail` | Chamar `logFollows.start({ connectionId, path })`, que o REC-008 já trata |
| Mostrar as ações no FTP | O painel FTP oferece diretório e log de uma conexão SSH | Renderizar só com `protocol === 'ssh'`. O Cypress do FTP afirma que o botão não está lá |
| `cd` no terminal aberto | A ação do painel mexe numa sessão que a pessoa não pediu | Não escrever no PTY. O REC-002 aplica a pasta na próxima sessão |

## Notas de implementação

- ADR não entra: sem dependência, sem porta nova, sem coluna, sem segredo no renderer. O canal e o `tail` citado já estão no ADR 0019. O quadro pelo path não entra no export.
- O menu fecha no `onSelect`. Estado do diálogo e da requisição fica no `FileBrowserView`.
- O botão reusa o texto `connection.terminalSelection.setDirectory`. Os dois itens de log ganham chaves novas. Os toasts reusam `connection.terminalSelection.*`.
- Sucesso de **Adicionar ao monitoramento**: gravar a lista e só então `logFollows.start({ connectionId, logFileId })`. Se o start falhar, a lista já está salva.
- Homologação em 2026-11-02, sem ajuste de código.
