# REC-010 — Arquivos do diretório atual ao lado do terminal

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-010
- **Criado em:** 2026-11-02
- **Última atualização:** 2026-11-03
- **ADRs:** [ADR 0020](../../adr/0020-listagem-cwd-terminal-ssh.md)

## Visão geral

No terminal SSH de uma conexão salva, uma badge ao lado do ambiente abre um painel à direita do xterm. O painel lista a pasta em que o shell está, com o visual da lista remota do navegador SFTP: nome, tamanho, data e permissões. Um `cd` troca a lista. Fechar a badge esconde o painel.

A pasta vem de OSC 7 emitido pelo prompt desta sessão, não de um `ls` no terminal e não da aba de arquivos. O diretório inicial do [REC-002](../rec-002-diretorio-padrao-ssh/especificacao.md) só leva o shell até a primeira pasta. Este recurso não grava diretório padrão nem arquivo de log; isso continua no [REC-009](../rec-009-diretorio-e-monitoramento-sftp/especificacao.md), no navegador.

## Decisões

Herdadas da IDEIA-010 e registradas no [ADR 0020](../../adr/0020-listagem-cwd-terminal-ssh.md):

- A pasta corrente vem de OSC 7 desta sessão. Não usa `/proc` nem o texto digitado. O gancho não é gravado no servidor.
- O painel só reflete o terminal. Clicar numa pasta não dá `cd`.
- Vale só para o terminal SSH de uma conexão salva. Shell local, FTP, RDP e o navegador de dois lados ficam como estão.
- Sem a pasta conhecida, o painel espera ou avisa. Não lista o diretório de login no lugar.
- Shell que não é bash nem zsh não emite a sequência. O painel avisa e não usa o login como substituto.

Fechadas na spec:

- A badge fica em `SessionIdentityBar`, logo depois de `EnvironmentBadge`. Sem ambiente, fica depois do chip da pasta. Não entra no grupo da direita (`children`), onde estão branch e nota de agente. É botão com ícone `FolderTree`, rótulo **Arquivos**, `aria-pressed` e `data-testid="terminal-cwd-toggle"`. Sem atalho.
- A badge só existe no `TerminalView` de uma sessão com `connectionId` e `protocol === 'ssh'`. Terminal local, Telnet, serial, workspace de agente e a barra do workflow não a mostram.
- O painel é um `ResizablePanel` à direita do xterm. Some por completo quando a badge está solta; fechado, não pede listagem. Aberto de novo, lista a última pasta OSC. O estado aberto/fechado é da aba, não da conexão.
- A lista reusa `FilePane` no lado remoto, em modo espelho. A pasta listada é só a do OSC 7. Clique em pasta, campo de caminho, subir e home não mudam essa pasta e não escrevem no PTY. Não há upload, download, criar, renomear, excluir, arrastar, **Definir diretório padrão** nem as ações de log do REC-009. Atualizar relê a mesma pasta e também não escreve no PTY.
- O aviso único, enquanto não houver OSC 7 válido, diz que o North ainda não recebeu a pasta e que só o prompt do bash e do zsh desta sessão informa isso. Não há segundo estado por timeout: dash, ash e fish caem nesse aviso.
- O gancho é o trecho fixo do ADR 0020: o main lê `$SHELL` num exec curto, escreve uma vez só para bash ou zsh, depois do `cd` de diretório inicial, e não falha a sessão se isso não acontecer. O renderer não envia o texto.
- O parser do OSC 7 fica em `shared`. Aceita `file://`, ignora o host, percent-decodifica e exige absoluto POSIX seguro. Path vazio não vira `/`. O mesmo path não pede outra listagem. Path novo substitui a lista. Resposta atrasada de outra pasta é descartada.
- A listagem é `sessions:list-directory` com `{ sessionId, path }`. O main devolve `{ ok: true, entries }` ou `{ ok: false, reason: 'invalid' | 'missing' | 'unavailable' }`. Não repassa a mensagem do ssh2. `invalid` e `missing` usam o mesmo aviso de falha da lista. A sessão de terminal segue no estado em que estava.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | No terminal SSH de uma conexão salva, a badge **Arquivos** abre e fecha o painel à direita do xterm. | Alta |
| RF-02 | Com OSC 7 de uma pasta absoluta, o painel lista nome, tamanho, data e permissões dessa pasta. Um `cd` que emite outro OSC 7 troca a lista. | Alta |
| RF-03 | Sem OSC 7 válido, o painel mostra o aviso e não lista o diretório de login nem o diretório inicial. | Alta |
| RF-04 | Clicar numa pasta do painel não escreve no terminal e não muda a pasta listada. | Alta |
| RF-05 | Terminal local, Telnet, serial, workspace de agente, workflow, FTP, RDP e o navegador de arquivos não ganham a badge nem o gancho. | Alta |
| RF-06 | Falha de SFTP mostra o aviso de listagem. O terminal continua utilizável. | Alta |
| RF-07 | Rótulos do badge, do aviso de espera e da falha de listagem em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Shared:** `parseOsc7Cwd(payload)` em `src/shared/lib/osc7-cwd.ts`. Devolve o absoluto ou `null`. Reusa `isSafePosixAbsolute`. Não devolve `cd`. O gancho em si não mora no shared: o texto escrito no PTY fica no main.
- **IPC:** `sessions:list-directory`. Args `{ sessionId: string, path: string }`. Resultado `{ ok: true, entries: RemoteEntry[] } | { ok: false, reason: 'invalid' | 'missing' | 'unavailable' }`. Sem `MessagePort` novo.
- **Main:** em `SshDriver`, o gancho do ADR 0020 no `Client` que já tem o shell. A listagem abre SFTP curto, faz `readdir`, mapeia como `SftpDriver.list` e chama `end()`. Só a sessão SSH daquele `sessionId` atende. Outra sessão ou path recusado devolve `invalid` ou `unavailable`.
- **Preload:** `sessions.listDirectory` no `NorthApi`.
- **Renderer:** `TerminalView` guarda o cwd e o painel. O xterm registra o handler OSC 7 e solta no unmount. `FilePane` ganha o modo espelho sem mudar o navegador quando o modo está ausente. A query de lista só roda com o painel aberto e com path válido.
- **Dados:** nenhum. Sem migration, sem coluna, sem import/export.
- **Segurança:** o path do OSC é dado do servidor. O main valida de novo antes do `readdir`. O renderer não recebe segredo e não escolhe o gancho. Credencial continua no vault, no main.

## Interface / UX

Badge só na barra do terminal SSH salvo, depois do ambiente. Painel à direita, divisória redimensionável, terminal à esquerda. Sem atalho.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Badge | Arquivos | Files | Archivos |
| À espera do OSC 7 | A pasta do terminal ainda não chegou. O North lê o prompt do bash e do zsh desta sessão e não mostra o diretório de login no lugar. | The terminal folder has not arrived yet. North reads this session's bash and zsh prompt and does not show the login directory instead. | La carpeta del terminal todavía no llegó. North lee el prompt de bash y zsh de esta sesión y no muestra el directorio de login en su lugar. |
| Falha ao listar | Não foi possível listar esta pasta. | Could not list this folder. | No se pudo listar esta carpeta. |

A linha da lista segue as colunas remotas que o `FilePane` já mostra. Dono entra se a linha remota já o mostra. Não há coluna nova.

## Critérios de aceite

- [x] Terminal SSH de conexão salva mostra a badge. Terminal local, workflow, FTP e o navegador não mostram.
- [x] Abrir a badge antes do primeiro OSC 7 mostra o aviso e não lista o login nem o diretório inicial.
- [x] Com o shell em `/var`, o painel lista `/var`. Depois de `cd /var/log`, a lista passa a ser `/var/log`.
- [x] Clicar numa pasta do painel não escreve `cd` no terminal e a lista continua na pasta do OSC 7.
- [x] Fechar a badge esconde o painel e não pede nova listagem. Abrir de novo lista a pasta corrente.
- [x] Bash e zsh recebem o gancho nesta sessão. O gancho não aparece em `.bashrc` nem `.zshrc`. Fish não recebe o trecho; o painel fica no aviso.
- [x] Falha de SFTP avisa no painel e o terminal segue utilizável.
- [x] Rótulos em pt-BR, en e es.
- [x] Vitest cobre `parseOsc7Cwd`: host ignorado, `%20` e `%2F`, path relativo recusado, scheme que não é `file` recusado, vazio que não vira `/`.

## Fora de escopo

- Navegar no painel para uma pasta que não é a do terminal.
- Upload, download, criar, renomear, excluir e arrastar. Isso continua no navegador SFTP.
- Gravar diretório inicial ou arquivo de log por este painel.
- `cd` automático ao clicar.
- Suporte a fish, dash e ash além do aviso.
- Terminal local, Telnet, serial, RDP, FTP e workspace de agente.
- Traduzir o restante do menu do navegador de arquivos.
- Migration, North Server, CSV, export.
- Atalho de teclado.

## Documentação de produto

- Manual: extensão da seção Terminal do capítulo `connect`, nos 3 locales. Escrita em 2026-11-02.
- What's new: fica para o bump da próxima versão. O app está em `0.1.46`, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- Engenharia: `docs/08-protocolos.md` e `docs/06-seguranca.md`. `docs/04-modelo-dados.md` não muda. O [ADR 0020](../../adr/0020-listagem-cwd-terminal-ssh.md) continua Proposto até o usuário aceitar.

## Resultado final

Entregue em 2026-11-02 e homologado em 2026-11-03, sem ajuste de código.

No terminal SSH de uma conexão salva, a badge **Arquivos** abre um painel à direita do xterm com os arquivos da pasta do shell. A pasta chega por OSC 7 do prompt desta sessão. Um `cd` troca a lista. Clicar numa pasta não escreve no terminal. Sem OSC 7, o painel avisa e não lista o diretório de login. O gancho fica só no main, uma vez, para bash e zsh, e não é gravado no servidor. No zsh ele entra em `precmd_functions`, para não substituir um `precmd` que já exista, e roda uma vez ao instalar. Fish, dash e ash não recebem o trecho.

Não há coluna nova. O what's new espera a próxima versão.

Arquivos principais: `src/shared/lib/osc7-cwd.ts`, `src/main/protocols/ssh-osc7-hook.ts`, `src/main/protocols/ssh-directory-list.ts`, `src/renderer/src/features/sessions/TerminalView.tsx`, `src/renderer/src/features/sessions/file-browser/FilePane.tsx`.
