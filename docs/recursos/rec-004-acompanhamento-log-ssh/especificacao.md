# REC-004 — Acompanhamento de log na conexão SSH

- **Status:** 🧪 Em testes
- **Ideia de origem:** IDEIA-004
- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **ADRs:** [ADR 0019](../../adr/0019-acompanhamento-log-ssh.md)

## Visão geral

Cada conexão SSH pode listar arquivos de log no servidor. Para cada arquivo, a pessoa abre um quadro que acompanha o arquivo em tempo real e continua no arquivo novo quando o log rotaciona. O quadro pode ser destacado para uma janela própria, que permanece visível com a janela principal minimizada. Sem nenhum arquivo, a conexão funciona como hoje.

Quem opera um serviço deixa de manter um terminal só para o `tail` preso na janela principal.

O [ADR 0016](../../adr/0016-logs.md) continua proposto e sem implementação. Esta entrega não cria área de logs, banco, busca nem ingestão.

## Decisões

Herdadas da IDEIA-004:

- Vários arquivos por conexão. Cada um tem o próprio quadro e pode ser destacado sozinho.
- O acompanhamento abre um canal próprio, com as credenciais da conexão. Não reusa o terminal da sessão.
- O widget continua visível com a janela principal minimizada. É janela do North: fechar o app fecha o widget.
- A rotação entra agora: o acompanhamento segue o nome do arquivo (`tail -F`).

Fechadas na spec e no [ADR 0019](../../adr/0019-acompanhamento-log-ssh.md):

- Nome no código: `logFiles` (coluna `log_files`), item `{ id, path, label }`. Na UI: **Arquivos de log**.
- Até 8 arquivos por conexão e até 8 acompanhamentos abertos no app. O nono mostra erro traduzido.
- O path guardado é o que a pessoa digitou (trim, barras finais removidas), não o absoluto resolvido. `~/app/app.log` continua assim se o home mudar.
- Forma do path: a mesma de `startupDirectory` — absoluto POSIX ou `~` / `~/...`. Relativo sem `~`, `~outro` e caractere de controle são recusados. Teto de 4096. Rótulo opcional, teto de 80, vazio vira `null`.
- Path duplicado na mesma conexão não salva.
- Trocar o protocolo para fora de SSH limpa a lista no save.
- O acompanhamento não começa sozinho ao abrir o app nem ao conectar o terminal. A pessoa clica em **Acompanhar** no detalhe da conexão. Se aquele arquivo já está ao vivo, o clique só traz o quadro ou o widget para a frente.
- O quadro na janela principal fica numa faixa no rodapé do `AppShell`, visível também com uma aba de sessão aberta. Sem quadro, a faixa não ocupa altura.
- **Destacar** move o quadro para uma `BrowserWindow` sem `parent` e sem sempre-por-cima. **Recolher** devolve para a faixa. Fechar o quadro ou o widget encerra aquele SSH.
- Comando fixo, sem PTY: `tail -n 200 -F --` + path absoluto citado (`quotePosixArg`). `~` resolve por SFTP (`realpath('.')`) antes do exec. Path absoluto não precisa de SFTP. Se o `~` não puder ser resolvido, o quadro mostra erro e não há expansão pelo shell.
- Arquivo ainda inexistente não é erro: o `tail -F` espera. Se o processo sair ou o SSH cair, o quadro fica em erro com **Tentar de novo**. Sem reconexão em loop.
- Host key: o mesmo prompt de `known_hosts` das sessões. Sem o auto-aceite dos workflows. Prompt pendente restaura e foca a janela principal, onde o `HostKeyDialog` já vive.
- VPN: o mesmo `vpnGate.ensure` de `ProtocolManager.open`, inclusive não sondar o host final quando há `jumpHostId`. Auth pelo `buildSshConnectConfig`. Esta entrega não implementa proxy de jump host além do que a sessão SSH já faz.
- Um `Client` ssh2 por acompanhamento. Destacar ou recolher troca o `MessagePort` e reenvia no máximo 256 KiB do texto recente. O SSH permanece.
- O texto do log não é gravado, não entra na palette e não entra em export. A lista de paths entra no JSON, na cópia de workspace e no North Server. CSV sem coluna nova.
- Editar o path ou a credencial não altera um acompanhamento já aberto. O próximo **Acompanhar** usa o valor novo.
- No Windows e no Linux, fechar a janela principal encerra o app e os widgets quando **Fechar para a bandeja** está desligada e não há VPN. Com a opção ligada, ou com um perfil de VPN, a janela só se esconde e os widgets continuam ([REC-011](../rec-011-fechar-janela-para-bandeja/especificacao.md)). No macOS, fechar a janela principal deixa os widgets até o Quit. Minimizar nunca encerra.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | O formulário da conexão SSH edita a lista **Arquivos de log** (path obrigatório, rótulo opcional), nos 3 locales. Outros protocolos não mostram a lista. | Alta |
| RF-02 | Dá para salvar até 8 paths válidos. Path inválido, duplicado ou controle no rótulo não salva. | Alta |
| RF-03 | Sem arquivos, não há ação de acompanhar e a conexão abre como hoje. | Alta |
| RF-04 | **Acompanhar** abre um quadro ao vivo daquele arquivo, com o nome da conexão e o rótulo ou o path. | Alta |
| RF-05 | O quadro segue o arquivo depois da rotação (`tail -F`) e mostra as últimas 200 linhas ao conectar. | Alta |
| RF-06 | **Destacar** tira o quadro da janela principal e abre uma janela que continua visível com a principal minimizada. **Recolher** faz o caminho inverso sem derrubar o SSH. | Alta |
| RF-07 | Fechar o quadro, fechar o widget ou encerrar o app encerra só aquele SSH (ou todos, no quit). | Alta |
| RF-08 | Um segundo **Acompanhar** no mesmo arquivo foca o quadro já aberto. O nono acompanhamento no app é recusado com mensagem traduzida. | Média |
| RF-09 | Falha de auth, host key recusada, `tail` ausente, processo encerrado ou queda do SSH deixam o quadro em erro, com **Tentar de novo**. | Alta |
| RF-10 | Export/import JSON, cópia de workspace e o inventário do North Server preservam a lista. CSV não ganha coluna. | Alta |
| RF-11 | Rolar para cima pausa o auto-scroll. **Ir para o fim** retoma. O quadro não envia tecla para o servidor. | Média |

## Requisitos técnicos

- **Shared:** `logFiles` em `ConnectionSchema`, com `.default([])` para inventário antigo sem a chave. Item: `id` (uuid), `path`, `label` (`string | null`). `CreateConnectionInputSchema` aceita a lista opcional. `normalizeLogFilePath` e `buildTailFollowCommand` em `src/shared/lib/log-file.ts`. A citação reusa `quotePosixArg`.
- **Main:** migration `021-connection-log-files` (`ALTER TABLE connections ADD COLUMN log_files TEXT`). Repositório grava JSON e lê como `links` (coluna vazia → `[]`). Serviço novo `LogFollowService`: um ssh2 `Client` por follow, `buildSshConnectConfig`, `vpnGate.ensure` com a mesma regra de probe do `ProtocolManager.open`, host key pelo prompt já existente (sem criar `ProtocolSession` nem linha de histórico). Exec sem PTY. Anel de 256 KiB. `dispose` no `before-quit`.
- **Janela:** `BrowserWindow` sem `parent`, moldura nativa, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Tamanho inicial 520×420, mínimo 320×200. Carrega o mesmo renderer em `#/log-follow/:followId`, fora de `w/:workspaceId`. `paintWindows` não chama `setTitleBarOverlay` em janela sem overlay. Fechar a janela principal no Windows/Linux chama `app.quit` quando hoje o app encerraria (widgets abertos não contam como “ainda há janela”).
- **IPC:** `log-follows:start`, `log-follows:attach`, `log-follows:stop`, `log-follows:pop-out`, `log-follows:dock`, e `log-follows:port` para transferir o `MessagePort`. Args/result em `IpcInvokeMap`, Zod no handler. Mensagens do port: `data` (bytes utf-8), `state` (`connecting` | `awaiting-host-key` | `live` | `error` | `closed`), `error` com código (`HOST_KEY_REJECTED`, `AUTH_FAILED`, `TAIL_MISSING`, `TAIL_EXITED`, `PATH_UNRESOLVED`, `CONNECTION_LOST`, `LIMIT`). O código é traduzido no renderer. stderr do `tail` pode aparecer no quadro, com controle removido e linha cortada; não vai para log do app.
- **Renderer:** lista no `ConnectionFormDialog` só com protocolo `ssh`. Ação no `ConnectionDetailsPanel`. Faixa `LogFollowDock` no `AppShell`. Rota do widget com xterm só leitura (stdin desligado, scrollback limitado). Chaves em `pt-BR`, `en` e `es`.
- **Dados:** coluna nullable, sem backfill. North Server: migration `007-connection-log-files`, coluna em `CONNECTION_COLUMNS` / `JSON_COLUMNS` / `mapConnection`. CSV de inventário segue sem a coluna; o create grava `[]`.
- **Segurança:** path não é segredo, mas iria para um shell. Normalizar na borda, resolver `~` fora do shell, citar o absoluto, comando só com o prefixo fixo. Credencial só no main. Conteúdo do log fica na memória do quadro. Sem socket de escuta.

O main não cria catálogo de i18n. Códigos de erro sobem para o renderer traduzir. Rótulos do formulário, do detalhe, da faixa e do widget são traduzidos.

## Interface / UX

- Formulário SSH: lista com adicionar, path mono (placeholder `/var/log/app.log` ou `~/app/app.log`), rótulo opcional, remover. Descrição curta: o quadro acompanha o arquivo e continua depois da rotação. Aos 8 itens, adicionar desabilita.
- Path ou rótulo rejeitado: erro no campo, sem salvar.
- Detalhe da conexão: uma linha por arquivo, com **Acompanhar**. Lista vazia: a seção não aparece.
- Faixa: nome da conexão, rótulo ou path, estado (conectando, ao vivo, erro). Ações **Destacar** e fechar. **Ir para o fim** quando o auto-scroll está pausado.
- Widget: título com o nome da conexão e o rótulo ou o basename. Ações **Recolher** e fechar. Mesmo tema do app (o hook de tema já está na raiz do renderer).
- Host key: o diálogo que já existe, na janela principal.
- Sem atalho novo.

## Critérios de aceite

- [ ] Conexão SSH sem arquivos abre o terminal como hoje e não mostra **Acompanhar**.
- [ ] Com `/var/log/app.log` (ou outro arquivo que exista), o quadro mostra linhas novas sem usar o terminal da sessão.
- [ ] Depois de rotacionar o arquivo (nome recriado), linhas novas continuam aparecendo.
- [ ] Path com espaço e path com `'` são citados. Um valor com `; rm` não executa nada além do `tail` daquele path.
- [ ] `var/log/app.log` e `~outro` não salvam. `~/app/app.log` salva como `~/app/app.log`.
- [ ] **Destacar** deixa o quadro visível com a janela principal minimizada. **Recolher** devolve para a faixa sem reconectar.
- [ ] Fechar o widget encerra o SSH. Encerrar o app encerra todos.
- [ ] Host desconhecido pede o diálogo já existente. Recusar deixa o quadro em erro e não conecta.
- [ ] Export JSON e o inventário do servidor devolvem a lista. CSV inalterado.
- [ ] Rótulos em pt-BR, en e es.
- [ ] Vitest cobre a normalização, o comando citado, o anel e a migration até `user_version` 21.

## Fora de escopo

- Área de logs do ADR 0016: banco, busca, retenção, histograma, ingestão, `journalctl`, `docker logs`.
- Comando livre, `sudo`, filtro e destaque de texto no quadro.
- Várias janelas de workspace (item **Multi-janela** do roadmap).
- Posição e tamanho do widget lembrados entre execuções.
- Reordenar a lista por arraste.
- Acompanhamento automático ao abrir o app.
- Gravar o texto do log ou indexá-lo na palette.
- Coluna nova no CSV.
- Proxy de jump host que a sessão SSH ainda não faz.
- Catálogo de i18n no main.

## Documentação de produto

- Manual: extensão do capítulo `connect` nos 3 locales (seção de SSH). Na implementação, não agora.
- What's new: entra no bump da próxima versão. O app está em `0.1.46`, e o diálogo só mostra notas até a versão do app.
- Engenharia, ao concluir: `logFiles` em `docs/04-modelo-dados.md`, o fluxo em `docs/08-protocolos.md`, a janela auxiliar em `docs/02-arquitetura.md`, o comando citado e a ausência de persistência do texto em `docs/06-seguranca.md`.
