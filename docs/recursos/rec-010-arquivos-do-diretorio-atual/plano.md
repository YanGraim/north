# Plano — REC-010 Arquivos do diretório atual ao lado do terminal

- **Criado em:** 2026-11-02
- **Última atualização:** 2026-11-03
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `parseOsc7Cwd` + Vitest | shared | ✅ |
| 2 | Gancho OSC 7 no shell SSH de conexão salva, só bash/zsh | main | ✅ |
| 3 | `sessions:list-directory` (contrato, main, preload) | shared / main / preload | ✅ |
| 4 | Badge, painel espelho, i18n (3 locales) | renderer | ✅ |
| 5 | Workflow Cypress continua sem a badge | test | ✅ |
| 6 | Manual `connect` (3 idiomas). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/lib/osc7-cwd.ts` e `osc7-cwd.test.ts`
- `src/shared/lib/selection-path.ts` (`isSafePosixAbsolute`)
- `src/shared/ipc/channels.ts`, `contract.ts`
- `src/main/protocols/ssh-driver.ts` (gancho depois do diretório inicial; SFTP curto no `Client` do shell)
- `src/main/protocols/sftp-driver.ts` (o mapeamento de `readdir` para `RemoteEntry` a reusar)
- `src/main/ipc/sessions.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/sessions/SessionIdentityBar.tsx` (slot depois de `EnvironmentBadge`)
- `src/renderer/src/features/sessions/TerminalView.tsx`
- `src/renderer/src/features/sessions/file-browser/FilePane.tsx` (modo espelho; o navegador sem o modo fica igual)
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`
- `cypress/e2e/workflows/run-success.cy.ts` (a barra do workflow não tem `terminal-cwd-toggle`)

Não há migration. O what's new fica para o bump. O manual entra na implementação.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Gancho substitui `PROMPT_COMMAND` ou `precmd` | O prompt da pessoa muda | Acrescentar, não substituir |
| Escrever bash num shell fish | Erro de sintaxe no terminal | Ler `$SHELL` com exec fixo e não escrever fora de bash/zsh. Falha da leitura não escreve e não derruba a sessão |
| Path do OSC vazio vira `/` | O painel lista a raiz no lugar da espera | `parseOsc7Cwd` devolve `null`. O main recusa de novo com `isSafePosixAbsolute` |
| Listar com o painel fechado | SFTP extra em toda sessão | A query só dispara com a badge presa e path válido |
| `FilePane` em modo espelho altera o navegador | O FTP perde ações | O modo é opt-in. Sem ele, o painel de hoje permanece |
| Resposta de `readdir` chega depois de outro `cd` | A lista mostra a pasta velha | Descartar quando o path da resposta não é o cwd atual |
| Mensagem crua do ssh2 no renderer | Detalhe interno do servidor na UI | Resultado `{ ok: false, reason }` e texto i18n |

## Notas de implementação

- O ADR 0020 descreve o gancho, o exec de `$SHELL` e por que isto não é `fs:list`.
- O modo espelho do `FilePane` esconde transferência, mutação e `sshActions`. Atualizar só chama `listDirectory` de novo na mesma pasta.
- O handler OSC 7 sai no unmount do xterm da aba.
- Homologação em 2026-11-03, sem ajuste de código.
- O zsh recebe o gancho em `precmd_functions`, para acrescentar sem substituir uma função `precmd` já existente. O trecho também chama o gancho uma vez ao instalar, para o primeiro OSC 7 não depender de um Enter.
- What's new continua fora deste patch. O ADR 0020 permanece Proposto.
