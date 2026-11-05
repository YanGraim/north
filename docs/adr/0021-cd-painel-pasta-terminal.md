# ADR 0021 — cd a partir do painel da pasta do terminal

- **Status:** Aceito
- **Data:** 2026-11-04
- **Recurso:** [REC-017](../recursos/rec-017-acoes-sftp-painel-terminal/especificacao.md)

## Contexto

O painel **Arquivos** do terminal SSH lista a pasta do shell e hoje só oferece **Atualizar**. Quem quer entrar numa pasta, baixar ou criar um arquivo abre outra aba SFTP ou digita no shell.

A IDEIA-017 fechou o recorte: as ações do painel remoto de SFTP valem nesta pasta, e entrar numa pasta, subir, ir para a pasta inicial ou clicar num trecho do caminho escreve `cd` no shell. A lista só muda quando o prompt emite outro OSC 7. O `cd` espera se a linha já tiver texto.

Isso revisa a decisão 5 do [ADR 0020](./0020-listagem-cwd-terminal-ssh.md), que diz que um clique não escreve no PTY e que o path vindo do servidor não entra num comando. As decisões 1 a 4 daquele ADR continuam: OSC 7 nesta sessão, gancho fixo só para bash e zsh, path validado no main, SFTP curto no `Client` do shell.

Encosta ainda em:

- [ADR 0007](./0007-nucleo-de-sessoes.md): o PTY segue no canal de bytes da sessão. O `cd` é uma escrita curta nesse canal, não um `MessagePort` novo.
- [ADR 0008](./0008-file-transfer-ipc.md): `fs:*` continua sendo a sessão `file-transfer` do navegador de dois lados. Este painel não abre essa sessão.

Restrições de [docs/06-seguranca.md](../06-seguranca.md): credencial só no main; o renderer não escolhe o texto que entra no shell; um caminho vindo do servidor não pode quebrar as aspas de um comando.

## Decisões

1. **A navegação escreve `cd`; a lista continua no OSC 7.** Entrar numa pasta, `..`, subir, pasta inicial, trecho do caminho e Enter no campo pedem `cd` para um absoluto. O painel não troca a pasta listada por conta própria. Criar, renomear, excluir, baixar, enviar, atualizar, gravar o diretório inicial e acompanhar log não escrevem no PTY.
2. **O texto do `cd` nasce no main.** O renderer envia o path. O main só escreve se `isSafePosixAbsolute` aceitar o absoluto, depois de `canonicalPosixDir`. O comando é `startupCdCommand` (`cd --` com `shellQuote` e `\r`). `~` e `~/...` resolvem contra o diretório de login desta sessão antes das aspas. Relativo, `~outro` e caractere de controle não são escritos. O eco dessa linha aparece no terminal: não é o gancho do ADR 0020 e não é escondido.
3. **Um `cd` por vez, e só com o prompt livre.** O main observa o stdin desta sessão e o OSC 7 do stdout. OSC 7 marca prompt desenhado e linha vazia. Stdin depois disso, até `\r`, ocupa a linha. `\r` ocupa a sessão até o próximo OSC 7. Se a linha ou o comando em primeiro plano estiver ocupado, o pedido fica numa fila de um (o último path substitui o anterior) e sai quando o prompt estiver livre. A escrita não manda Ctrl-C, Ctrl-U nem apaga o que a pessoa digitou. Fechar a badge ou a sessão descarta a fila. O mesmo path que o OSC 7 já lista não gera `cd`.
4. **Alterar arquivo é SFTP curto no `Client` do shell.** Criar, renomear, excluir, baixar e enviar abrem o canal auxiliar, operam e chamam `end()`, no mesmo espírito de `listRemoteDirectory`. Não chamam `fs:*` e não abrem segunda conexão SSH. O path remoto volta a ser validado no main. A mensagem do ssh2 não volta ao renderer. Baixar pede a pasta local num diálogo aberto pelo main; o renderer não escolhe esse caminho. Enviar usa o seletor de arquivo do main ou o arraste do sistema, e o destino remoto é a pasta do OSC 7.

## Alternativas

- **O renderer monta a linha e chama `sessions:stdin`:** rejeitada. O renderer passaria a escolher bytes no shell, e um path com aspas poderia sair do `shellQuote`.
- **Trocar a pasta listada sem `cd`:** rejeitada. O painel deixaria de ser a pasta do terminal, que é a regra que a IDEIA-017 manteve.
- **Mutação por `fs:*` ou segunda sessão SSH:** rejeitada. Autentica de novo e tira o navegador de dois lados do [ADR 0008](./0008-file-transfer-ipc.md).
- **Ctrl-C para liberar a linha:** rejeitada. Mataria o programa que está em primeiro plano.
- **Esconder o eco do `cd`:** rejeitada. A pessoa precisa ver o comando que o painel disparou. O descarte de eco continua exclusivo do gancho do ADR 0020.

## Consequências

- Canais novos de sessão para `cd`, pasta inicial e a mutação SFTP curta. Sem migration e sem mudança de import/export. O segredo continua no main.
- A decisão 5 do [ADR 0020](./0020-listagem-cwd-terminal-ssh.md) deixa de valer para esta navegação. Listagem, gancho e a recusa de interpolar path em qualquer outro comando continuam naquele ADR.
- Manual (capítulo `connect`, seção Terminal, 3 idiomas), `docs/08-protocolos.md` e `docs/06-seguranca.md` atualizados com o REC-017. O what's new entra no bump da próxima versão. `docs/04-modelo-dados.md` não muda.
