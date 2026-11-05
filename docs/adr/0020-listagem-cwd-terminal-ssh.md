# ADR 0020 — Pasta corrente do terminal SSH por OSC 7

- **Status:** Proposto
- **Data:** 2026-11-02
- **Recurso:** [REC-010](../recursos/rec-010-arquivos-do-diretorio-atual/especificacao.md)
- **Revisão:** a decisão 5 (o painel não escreve no PTY) passa a ser a do [ADR 0021](./0021-cd-painel-pasta-terminal.md) para a navegação. Listagem, gancho e OSC 7 continuam neste ADR.

## Contexto

Quem está no meio de um deploy vê a pasta no prompt (`root@host:/var/www/html#`) e, para ver os arquivos, abre outra aba SFTP. Essa aba começa no diretório inicial da conexão e não segue o `cd` do terminal.

A IDEIA-010 já fechou o recorte: um painel à direita do xterm, só o lado remoto, preso à sessão SSH de uma conexão salva. A pasta corrente vem de OSC 7 emitido pelo prompt desta sessão. O gancho não é gravado no servidor. Clicar numa pasta não dá `cd`. Sem pasta conhecida, o painel não lista o diretório de login no lugar.

Isso encosta em decisões que este ADR não absorve:

- [ADR 0007](./0007-nucleo-de-sessoes.md) reserva `MessagePort` aos bytes da sessão. O PTY continua nesse canal. Uma listagem é pedido e resposta.
- [ADR 0008](./0008-file-transfer-ipc.md) põe `fs:list` numa sessão `file-transfer`. O navegador de dois lados continua assim. Este painel não abre essa sessão.
- [ADR 0019](./0019-acompanhamento-log-ssh.md) abre outro `Client` para `tail -F`. Aqui a listagem usa o `Client` que já segura o shell, no mesmo espírito do `stat` curto de `ssh-driver.ts`.

Restrições: credencial só no main (`docs/06-seguranca.md`, ADR 0005); o renderer não escolhe o texto escrito no PTY; o caminho que chega do servidor não entra num shell.

## Decisões

1. **OSC 7, nesta sessão.** A pasta é o path de um OSC 7 `file://` lido do PTY com `parser.registerOscHandler`. Não vem de `/proc`, do texto digitado, nem do prompt desenhado na tela. O gancho é um trecho fixo do main, acrescentado a `PROMPT_COMMAND` (bash) e `precmd` (zsh), sem substituir o que já existir. Não grava `.bashrc`, `.zshrc` nem `.profile`. A sessão continua de pé se o gancho não entrar.
2. **Só bash e zsh, e só no shell interativo da conexão salva.** Antes de escrever, o main lê `$SHELL` com um exec curto e fixo no mesmo `Client`. Se o valor é bash ou zsh, escreve o gancho uma vez, depois do `cd` de diretório inicial do REC-002. Outro shell, falha da leitura ou sessão sem `connectionId` (terminal local, workspace de agente, exec de workflow): não escreve. O renderer não manda o texto do gancho. O eco dessa linha é retirado do fluxo do PTY antes do xterm. Se os bytes que voltam não são exatamente o gancho, seguem inteiros: o main não esconde outra saída.
3. **O OSC é um path, validado no main.** O renderer tira o path do `file://` e percent-decodifica. O main só lista se `isSafePosixAbsolute` aceitar o absoluto, sem cair em `/` quando o path vem vazio. Esse path não é interpolado em comando. Não há `ls` no PTY.
4. **SFTP curto no `Client` do shell.** O canal é `sessions:list-directory`: `readdir`, mapeia `RemoteEntry`, `end()` no fim, como o `stat` auxiliar. Não abre segunda conexão SSH e não chama `fs:list`. Enquanto o painel está fechado, não lista. Resposta de uma pasta que já não é a corrente é descartada. Falha de listagem não derruba o terminal.
5. **O painel só reflete.** Não escreve no PTY. Clicar numa pasta não dá `cd` e não troca a pasta listada. Não grava diretório inicial nem arquivo de log. A navegação com `cd` e as ações de arquivo ficam no [ADR 0021](./0021-cd-painel-pasta-terminal.md); o path continua sem entrar em qualquer outro comando.

## Alternativas

- **`/proc/<pid>/cwd`:** rejeitada. Só existe no Linux e quebra quando o sshd muda a árvore de processos.
- **Ler o `cd` digitado:** rejeitada. Falha, script, `pushd` e alias mentem a pasta.
- **Gravar o gancho em `.bashrc` / `.zshrc`:** rejeitada. Altera o servidor fora desta sessão.
- **`ls` no PTY:** rejeitada. Mistura a lista com o shell da pessoa.
- **Segunda sessão SFTP ou `fs:list`:** rejeitada. Autentica de novo e não é o `Client` que já está no shell. O [ADR 0008](./0008-file-transfer-ipc.md) continua valendo para o navegador.
- **Gancho com texto vindo do renderer:** rejeitada. O renderer passaria a escolher bytes no shell remoto.
- **Listar o diretório de login enquanto o OSC não chega:** rejeitada. Essa pasta não é a do terminal.

## Consequências

- IPC novo `sessions:list-directory`. Sem migration, sem coluna, sem mudança de import/export. O segredo continua no main.
- O eco do gancho não entra no scrollback quando volta igual ao que foi escrito. Não imprime listagem. Fish e os outros shells que não são bash nem zsh não recebem o trecho; o painel fica no aviso e não mostra o login.
- `$SHELL` é o shell de login. Se a pessoa trocou de shell dentro da sessão, o gancho pode não corresponder ao prompt. O painel continua dependendo do OSC 7, não dessa leitura.
- Ao concluir o REC-010: manual (`connect`, seção Terminal, 3 idiomas), what's new da próxima versão, `docs/08-protocolos.md` e uma nota em `docs/06-seguranca.md`. `docs/04-modelo-dados.md` não muda.
- O [ADR 0008](./0008-file-transfer-ipc.md) e o [ADR 0019](./0019-acompanhamento-log-ssh.md) permanecem como estão. Este ADR passa a `Aceito` só quando o usuário aceitar a decisão.
