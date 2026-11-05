# REC-017 — Ações de SFTP no painel da pasta do terminal

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-017
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** [ADR 0021](../../adr/0021-cd-painel-pasta-terminal.md)

## Visão geral

No painel **Arquivos** ao lado do terminal SSH, a pasta do shell ganha as ações do painel remoto de SFTP: baixar, enviar, abrir, nova pasta, renomear, excluir, atualizar, gravar o diretório inicial e acompanhar log. Entrar numa pasta, subir, ir para a pasta inicial ou clicar num trecho do caminho escreve `cd` no shell. A lista continua sendo a pasta que o prompt confirmar.

Baixar pede a pasta de destino, porque este painel não tem o lado local. Enviar usa um seletor de arquivo ou um arraste vindo de fora. O navegador de dois lados, o FTP e o terminal local ficam como estão.

## Decisões

Herdadas da IDEIA-017 e registradas no [ADR 0021](../../adr/0021-cd-painel-pasta-terminal.md):

- As ações do SFTP remoto valem neste painel, na pasta em que o terminal está.
- A navegação escreve `cd` no shell. A lista só muda com o OSC 7.
- O `cd` só sai com o prompt livre. Se a linha já tiver texto, ou se houver um comando em primeiro plano, a navegação espera. Não completa a linha que a pessoa está digitando.

Fechadas na spec:

- Vale só no `TerminalCwdPanel` de uma sessão SSH com `connectionId`. O modo `mirror` deixa de ser uma trava única: a pasta listada continua vindo só do OSC 7, e as ações passam a ter efeito. O `FilePane` do navegador de dois lados não recebe esses callbacks e não escreve `cd`.
- Sem OSC 7 válido, o painel continua no aviso do [REC-010](../rec-010-arquivos-do-diretorio-atual/especificacao.md). Não há barra de ações nem `cd`.
- **Atualizar** relê a pasta do OSC 7 e não escreve no PTY.
- Duplo clique ou **Abrir** numa pasta pede `cd` para esse path. Num arquivo, pede o destino e baixa. Num link, a listagem curta decide: se for pasta, pede `cd`; se a listagem falhar, baixa.
- `..` e **Pasta superior** pedem `cd` para o pai. Em `/`, o controle continua desabilitado.
- **Pasta inicial** pede `cd` para o diretório de login desta sessão, o mesmo conceito do Home do painel remoto. Não usa `startup_directory` e não envia `cd` sem path. Sem o login conhecido, o botão fica desabilitado.
- A barra de caminho do [REC-015](../rec-015-caminho-clicavel-painel-arquivos/especificacao.md) passa a valer aqui. Um trecho anterior pede `cd` para esse prefixo. O trecho final e a área vazia abrem o campo. Enter pede `cd` se o texto for absoluto seguro ou `~` / `~/...` resolvido contra o login. Escape ou blur devolve os trechos da pasta do OSC 7. Relativo e `~outro` avisam e não escrevem.
- **Nova pasta**, **Renomear** e **Excluir** usam os diálogos que o `FilePane` já tem, inclusive “Excluir do servidor?”. Operam por SFTP curto na pasta do OSC 7 e, ao terminar, atualizam essa lista. Não mudam o shell.
- **Baixar para a pasta local** (menu e F5) e **Abrir** num arquivo abrem um diálogo de pasta no main. Os nomes caem nessa pasta. Conflito de nome reusa o diálogo que o navegador já mostra. **Enviar** abre o seletor de arquivos no main, ou aceita o arraste do sistema, e grava na pasta do OSC 7. Arrastar uma linha do painel para fora não transfere.
- **Definir diretório inicial**, **Adicionar ao monitoramento** e **Monitorar em tempo real** reusam o que o painel SFTP já faz na conexão salva ([REC-009](../rec-009-diretorio-e-monitoramento-sftp/especificacao.md)). A pasta gravada é a do OSC 7. As duas ações de log continuam exigindo um único arquivo.
- F2, F7 e Del seguem os atalhos que o `FilePane` já tem. Não há atalho novo.
- Enquanto um `cd` espera o prompt, o painel mostra um aviso curto e a lista permanece. Outro pedido de navegação substitui o path pendente. Fechar a badge ou a sessão descarta a espera. Quando o `cd` sai, o terminal mostra a linha. Se o shell recusar a pasta, o OSC 7 fica no path antigo, o aviso some e a lista não muda.
- Diretórios favoritos ([REC-016](../rec-016-diretorios-favoritos-painel-arquivos/especificacao.md)) e **Editar** / **Editar com…** ([REC-014](../rec-014-editar-arquivo-remoto/especificacao.md)) continuam só no navegador de dois lados.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Com OSC 7 válido, o painel oferece baixar, enviar, abrir, nova pasta, renomear, excluir, atualizar, definir diretório inicial e as duas ações de log. | Alta |
| RF-02 | Entrar numa pasta, `..`, subir, pasta inicial, trecho do caminho e Enter no campo pedem `cd`. A lista só troca quando o OSC 7 trouxer a pasta nova. | Alta |
| RF-03 | Com texto na linha ou comando em primeiro plano, o `cd` espera. Não altera o texto já digitado. Fechar a badge cancela a espera. | Alta |
| RF-04 | Baixar pede a pasta local de destino. Enviar usa seletor ou arraste do sistema para a pasta do OSC 7. | Alta |
| RF-05 | Criar, renomear, excluir e enviar atualizam a lista da pasta atual e não escrevem no PTY. Falha avisa e o terminal continua utilizável. | Alta |
| RF-06 | Sem OSC 7, o painel segue no aviso e não navega nem altera arquivo. | Alta |
| RF-07 | O navegador de dois lados, o FTP e o terminal local não ganham este `cd` nem estes canais. | Alta |
| RF-08 | Rótulos novos em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Shared:** o comando reusa `startupCdCommand` e `isSafePosixAbsolute`. Nenhum helper novo devolve uma linha de shell a partir de texto livre do renderer.
- **IPC:** no `Client` da sessão de terminal, sem `MessagePort` novo.
  - `sessions:change-directory` — args `{ sessionId, path }`. Resultado `{ ok: true, pending: boolean } | { ok: false, reason: 'invalid' | 'unavailable' }`. `pending: true` é a fila. O mesmo path do OSC 7 corrente devolve `pending: false` e não escreve.
  - `sessions:home` — args `{ sessionId }`. Resultado `{ ok: true, path: string } | { ok: false, reason: 'unavailable' }`. É o login já probeado na abertura, não um `cd`.
  - `sessions:mkdir`, `sessions:rename`, `sessions:delete` — path remoto validado de novo. Resultado `{ ok: true } | { ok: false, reason: 'invalid' | 'missing' | 'unavailable' }`. Sem a mensagem do ssh2.
  - `sessions:download` — args `{ sessionId, remotePath, isDir }`. O main abre o diálogo de pasta e grava ali. Resultado no formato de `TransferHandle`, ou `{ ok: false, reason: 'cancelled' | 'invalid' | 'unavailable' }`.
  - `sessions:upload` — args `{ sessionId, localPaths: string[] }` no arraste; o seletor não recebe path do renderer. Destino remoto é a pasta do OSC 7. Mesmo handle de transferência.
  - Progresso no formato de `TransferProgress` já usado pelo navegador, com o `sessionId` do terminal.
- **Main:** SFTP curto ao lado de `listRemoteDirectory`, um canal por operação, `end()` no fim. A fila do `cd` vive na sessão que já tem o PTY. O diálogo de pasta e o de arquivo abrem no main.
- **Preload:** métodos correspondentes em `NorthApi`.
- **Renderer:** `TerminalCwdPanel` deixa de passar `mkdir` / `rename` / `remove` / `openFile` vazios e passa a ligar as ações. `onPathChange` pede `sessions:change-directory` e não guarda o path pedido como pasta listada. `TerminalView` continua dono do cwd que vem do OSC 7.
- **Dados:** nenhum. Sem migration, sem coluna, sem import/export.
- **Segurança:** o path do OSC e o path do clique voltam a ser validados no main antes de `readdir`, mutação ou `cd`. O renderer não envia a linha do comando. A pasta local do download sai do diálogo do main. Credencial continua no vault.

## Interface / UX

A badge e o painel à direita continuam os do REC-010. Com pasta conhecida, a barra e o menu do `FilePane` remoto aparecem, menos favoritos e menos **Editar**. Sem atalho novo.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| `cd` em espera | O terminal está ocupado. A pasta muda quando o prompt estiver livre. | The terminal is busy. The folder changes when the prompt is free. | El terminal está ocupado. La carpeta cambia cuando el prompt esté libre. |
| Caminho recusado | Este caminho não pode ir para o shell. | This path cannot go to the shell. | Esta ruta no puede ir al shell. |
| Destino do download | Escolher pasta para baixar | Choose a folder to download | Elegir carpeta para descargar |
| Falha da operação | Não foi possível alterar esta pasta. | Could not change this folder. | No se pudo modificar esta carpeta. |

Rótulos que o menu do navegador já traduz (diretório inicial, monitoramento) reusam a chave existente. O que ainda está fixo em português nesse menu continua fixo, como no REC-009.

## Critérios de aceite

- [x] Com o shell em `/var`, entrar em `log` escreve `cd -- '/var/log'` e a lista só passa a `/var/log` quando o OSC 7 chegar.
- [x] Com texto já digitado na linha, o clique não completa o comando. O `cd` sai depois que a linha esvazia e o prompt volta. Fechar a badge antes disso não escreve `cd`.
- [x] Com `vim` ou outro comando em primeiro plano, o clique não escreve no processo. O `cd` espera o próximo prompt.
- [x] Subir, pasta inicial, trecho do caminho e Enter num absoluto seguem a mesma regra. Relativo não é escrito.
- [x] Nova pasta, renomear e excluir mudam o servidor, atualizam a lista e não escrevem no PTY. O diálogo de exclusão aparece.
- [x] Baixar pede a pasta local e grava o arquivo lá. Enviar pelo seletor e por arraste do sistema cai na pasta do OSC 7.
- [x] Definir diretório inicial e as duas ações de log se comportam como no painel SFTP da mesma conexão.
- [x] Sem OSC 7, o aviso do REC-010 permanece e não há `cd`.
- [x] FTP, terminal local e o navegador de dois lados não escrevem este `cd`. Favoritos e **Editar** não aparecem neste painel.
- [x] Rótulos novos em pt-BR, en e es.
- [x] Vitest cobre a fila: linha vazia escreve `startupCdCommand`; linha suja espera; `\r` espera o próximo OSC 7; o segundo pedido substitui o primeiro; fechar descarta; path inseguro não escreve; o mesmo path do OSC 7 não escreve.

## Fora de escopo

- Favoritos de diretório neste painel.
- **Editar** e **Editar com…**.
- Navegador de dois lados, FTP e terminal local.
- Fish, dash e ash além do aviso que o REC-010 já mostra.
- Atalho novo.
- Esconder o eco do `cd`.
- Migration, North Server, import/export.
- Traduzir o restante do menu que já estava fixo em português.

## Documentação de produto

- Manual: extensão da seção Terminal do capítulo `connect`, nos 3 locales. Escrita em 2026-11-04.
- What's new: fica para o bump da próxima versão. O app está em `0.1.47`, e o diálogo só mostra notas até a versão do app.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste de código.

No painel **Arquivos** do terminal SSH, a pasta do prompt aceita baixar, enviar, abrir, nova pasta, renomear, excluir, atualizar, definir o diretório inicial e acompanhar log. Entrar numa pasta, subir, ir para a pasta inicial ou clicar num trecho escreve `cd --` com o caminho entre aspas, e só com o prompt livre. A lista continua no OSC 7. Baixar pede a pasta local. Enviar usa o seletor ou um arraste do sistema. Favoritos e **Editar** ficam no navegador de dois lados.

O comando nasce no main. Criar, renomear, excluir, baixar e enviar usam SFTP curto no `Client` do shell. O what's new espera a próxima versão. O [ADR 0021](../../adr/0021-cd-painel-pasta-terminal.md) foi aceito em 2026-11-04.

Arquivos principais: `src/main/protocols/shell-prompt-gate.ts`, `src/main/protocols/ssh-session-files.ts`, `src/main/services/file-transfer/session-transfer.ts`, `src/renderer/src/features/sessions/TerminalCwdPanel.tsx`, `src/renderer/src/features/sessions/file-browser/FilePane.tsx`.
