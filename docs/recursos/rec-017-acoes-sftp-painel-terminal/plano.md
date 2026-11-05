# Plano — REC-017 Ações de SFTP no painel da pasta do terminal

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Fila do `cd` no main: OSC 7, stdin e `startupCdCommand` | main | ✅ |
| 2 | Canais `sessions:change-directory` e `sessions:home` | shared / main / preload | ✅ |
| 3 | SFTP curto: mkdir, rename, delete, download, upload | main | ✅ |
| 4 | Contratos, handlers e preload dessas operações | shared / main / preload | ✅ |
| 5 | `TerminalCwdPanel` e o `FilePane` com ações sem trocar a pasta listada | renderer | ✅ |
| 6 | Rótulos novos nos 3 locales | renderer | ✅ |
| 7 | Vitest da fila e do path recusado | test | ✅ |
| 8 | Manual (`connect`, 3 idiomas). What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/lib/startup-directory.ts` (`startupCdCommand`, já citado)
- `src/shared/lib/selection-path.ts` (`isSafePosixAbsolute`)
- `src/shared/ipc/channels.ts`, `src/shared/ipc/contract.ts`
- `src/main/protocols/ssh-directory-list.ts` (o SFTP curto a repetir)
- `src/main/protocols/ssh-driver.ts`, `src/main/services/protocol-manager.ts`
- `src/main/ipc/sessions.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/sessions/TerminalCwdPanel.tsx`
- `src/renderer/src/features/sessions/TerminalView.tsx`
- `src/renderer/src/features/sessions/file-browser/FilePane.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`
- `cypress/e2e/database/app-workspace-after-query.cy.ts` (a badge continua abrindo o aviso)
- `cypress/e2e/ftp/file-browser.cy.ts` (FTP continua sem a badge)

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| O renderer montar a linha do `cd` | Um path com aspas vira outro comando | Só o main escreve, e só `startupCdCommand` depois de `isSafePosixAbsolute` |
| `cd` no meio de uma linha ou de um `vim` | O comando da pessoa quebra, ou o processo recebe o texto | Fila de um no main; sem Ctrl-C; fechar a badge descarta |
| `onPathChange` passar a guardar o path pedido | A lista mente a pasta do shell | A pasta listada continua sendo só o OSC 7 |
| Mutação por `fs:*` | Segunda autenticação e o navegador de dois lados muda de contrato | SFTP curto no `Client` do shell, `end()` no fim |
| O diálogo de destino no renderer | O renderer escolhe qualquer path local | O diálogo abre no main |
| `mirror` liberado por completo | O navegador de dois lados ou o FTP ganha `cd` | Callbacks só no `TerminalCwdPanel` |
| Eco do `cd` descartado como o gancho | A pessoa não vê o comando | O descarte de eco continua só para o trecho fixo do ADR 0020 |

## Notas de implementação

O [ADR 0021](../../adr/0021-cd-painel-pasta-terminal.md) revisa a decisão 5 do [ADR 0020](../../adr/0020-listagem-cwd-terminal-ssh.md). Listagem, gancho e OSC 7 não mudam de dono.

`docs/08-protocolos.md` e `docs/06-seguranca.md` descrevem o painel que não escreve no PTY. Essa frase muda na conclusão do recurso, quando o comportamento existir. `docs/04-modelo-dados.md` não entra.

O login da **Pasta inicial** é um `realpath('.')` no `Client` da sessão, gravado antes do gancho. Não é um `fs:home` de sessão `file-transfer`.

Fechar a badge chama `sessions:cancel-directory-change`. O progresso de baixar e enviar reusa o evento `fs:progress`, filtrado pelo `sessionId` do terminal. Um download de vários arquivos pede a pasta uma vez e devolve um `destinationToken` para o restante do gesto. O aviso de espera some no próximo OSC 7, mesmo quando a pasta não muda.

O Cypress da badge não foi reexecutado. Os specs existentes só abrem o aviso sem OSC 7 e conferem que o FTP não tem a badge.
