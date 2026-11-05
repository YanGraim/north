# ADR 0019 — Acompanhamento de log SSH em janela auxiliar

- **Status:** Proposto
- **Data:** 2026-10-30
- **Recurso:** [REC-004](../recursos/rec-004-acompanhamento-log-ssh/especificacao.md)

## Contexto

Quem opera um serviço precisa ver um arquivo de log do servidor enquanto usa outra conexão, um SQL ou a lista. Hoje isso é um terminal só para o `tail`, preso na janela principal.

A IDEIA-004 já fechou o recorte de produto: vários arquivos por conexão SSH, um quadro por arquivo, canal próprio (sem reusar o PTY), `tail -F` para sobreviver à rotação, e um widget que continua visível com a janela principal minimizada. Fechar o app fecha o widget. Sem agente no servidor.

Isso encosta em duas decisões que este ADR não absorve:

- [ADR 0007](./0007-nucleo-de-sessoes.md) reserva `MessagePort` ao plano de dados de uma sessão do `ProtocolManager`. Um fluxo contínuo de bytes não volta a passar por `invoke`.
- [ADR 0016](./0016-logs.md) (proposto) descreve uma área de logs: banco separado, busca, retenção, várias origens. A opção A dela é pull via SSH, inclusive `tail`. As decisões de origem, banco e ingestão continuam em aberto. Este ADR só registra o ao vivo dos arquivos configurados na conexão.

O North tem uma janela. O roadmap ainda lista **Multi-janela** como trabalho futuro de workspaces. O widget é uma `BrowserWindow` auxiliar, não esse produto.

Restrições que valem aqui: credencial só no main (`docs/06-seguranca.md`, ADR 0005); `contextIsolation`, `sandbox` e `nodeIntegration: false` em toda janela; o main não abre socket de escuta.

## Decisões

1. **Metadado da conexão, não fonte de log.** Cada conexão SSH guarda uma lista de até 8 arquivos (`id`, `path`, `label` opcional). É inventário: entra no export/import JSON, na cópia de workspace e no North Server. O texto do log não é persistido, não entra no índice da palette e não entra em export.
2. **Fora do `ProtocolManager`.** O acompanhamento não é `SessionKind`, não abre aba de sessão e não grava histórico. Um serviço no main abre um `Client` ssh2 por acompanhamento, com `buildSshConnectConfig` e o mesmo `vpnGate.ensure` de uma sessão SSH. A verificação de host reusa o prompt de `known_hosts` (ADR 0007); não há auto-aceite de workflow.
3. **Comando fixo.** Depois de resolver `~` por SFTP (`realpath('.')`), o exec é `tail -n 200 -F --` mais o absoluto citado com `quotePosixArg`. O texto do formulário não entra no shell. Sem `sudo`, sem comando livre, sem `journalctl` e sem `docker logs`.
4. **`MessagePort` por acompanhamento.** O main segura o SSH. O renderer que está mostrando o quadro recebe o port. Destacar ou recolher troca o port e reenvia um anel curto do texto recente; o SSH continua. Bytes não passam por `invoke`.
5. **Janela auxiliar independente.** O widget não tem `parent`: no Windows uma janela filha some quando a principal é minimizada. Não fica sempre por cima. Mesmas flags de isolamento da janela principal. Minimizar a principal deixa o widget visível. `app.quit` encerra os acompanhamentos e as janelas. No Windows e no Linux, fechar a janela principal continua encerrando o app (salvo o recolher para a bandeja quando há VPN); widgets abertos não seguram o processo sozinhos. No macOS, fechar a janela principal não encerra o app, e os widgets ficam até o Quit.
6. **ADR 0016 intacto.** Nada de `north-logs.db`, FTS5, retenção, busca ou porta de ingestão.

## Alternativas

- **Digitar `tail` no PTY da sessão:** rejeitada. Mistura o log com o shell da pessoa e ainda prende o quadro na janela principal.
- **Implementar a área de logs do ADR 0016:** adiada. Busca, retenção e ingestão continuam sem decisão de origem.
- **`BrowserWindow` filha da principal:** rejeitada. Minimizar a principal esconderia o widget.
- **Sempre por cima:** rejeitada. O pedido é sobreviver à minimização, não cobrir os outros aplicativos.
- **Gravar as linhas no SQLite:** rejeitada. Volume e segredo dentro do log; o ao vivo não precisa de histórico.
- **Novo `SessionKind`:** rejeitada. Aba de sessão desmonta a experiência ao trocar de contexto e grava histórico. O quadro tem de continuar visível em outra conexão.
- **`tail -f`:** rejeitada. Perde o arquivo quando a rotação troca o inode. `-F` segue o nome.

## Consequências

- Migration no desktop e no North Server para a lista na conexão. CSV de inventário não ganha coluna.
- IPC novo `log-follows:*` e um `MessagePort` que não é o de `sessions:port`.
- `paintWindows` só pode chamar `setTitleBarOverlay` em janela criada com overlay. O widget usa moldura nativa.
- Fechar a janela principal no Windows/Linux precisa chamar `app.quit` mesmo com widgets abertos, para `window-all-closed` não deixar o processo vivo só com eles.
- Ao concluir o REC-004: manual (`connect`, 3 idiomas), what's new da próxima versão, `docs/02-arquitetura.md`, `docs/04-modelo-dados.md`, `docs/06-seguranca.md` e `docs/08-protocolos.md`.
- O ADR 0016 permanece proposto. Este ADR passa a `Aceito` só quando o usuário aceitar a decisão.

## Adendo (2026-11-04)

O [REC-011](../recursos/rec-011-fechar-janela-para-bandeja/especificacao.md) mudou o fechar da janela principal. A opção **Fechar para a bandeja** nasce ligada: fechar esconde a janela, com ou sem VPN. Com um perfil de VPN a opção fica bloqueada e ligada. Sem VPN e com a opção desligada, fechar no Windows e no Linux ainda encerra o app, e os widgets não seguram o processo sozinhos. No macOS, desligada, a janela fecha e o app fica até o Quit.
