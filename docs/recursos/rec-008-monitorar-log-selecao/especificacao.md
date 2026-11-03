# REC-008 — Monitorar log da seleção

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-008
- **Criado em:** 2026-10-31
- **Última atualização:** 2026-11-02
- **ADRs:** —

## Visão geral

No menu de contexto do terminal de uma sessão SSH, **Monitorar log** acompanha o arquivo do texto selecionado. O clique abre o quadro na faixa de baixo. O caminho não entra em **Arquivos de log** da conexão: vale só enquanto o quadro estiver aberto.

Quem já vê o caminho na tela deixa de copiar, abrir o cadastro, colar e clicar em **Acompanhar**.

O quadro é o do [REC-004](../rec-004-acompanhamento-log-ssh/especificacao.md): `tail -F`, canal próprio, credencial só no main. **Adicionar arquivo de log** ([REC-005](../rec-005-diretorio-log-selecao-terminal/especificacao.md)) continua sendo a ação que grava o arquivo na conexão. O [REC-009](../rec-009-diretorio-e-monitoramento-sftp/especificacao.md) chama este mesmo início a partir do SFTP; o menu do painel de arquivos fica de fora daqui.

## Decisões

Herdadas da IDEIA-008:

- Seleção que não é um caminho válido: o clique avisa e não abre quadro.
- Este acompanhamento não conta no teto de 8 quadros abertos do REC-004.
- Se aquele arquivo já está ao vivo, o clique só traz o painel para a frente.
- Fechar o quadro encerra o acompanhamento. A lista da conexão não muda.

Fechadas na spec:

- A ação só aparece no terminal de uma conexão com protocolo `ssh`. Shell local, telnet, serial, agente e workflow não mostram o item.
- Sem seleção, o item fica indisponível. O texto é `term.getSelection()` no clique.
- Caminho válido é o de `normalizeLogFilePath`: absoluto POSIX ou `~` / `~/...`. Relativo, `~outro`, aspas em volta, quebra de linha e caractere de controle são recusados no renderer e de novo no main. Não há `sessions:classify-path`. Diretório com path aceito abre o quadro; se o `tail` sair, o quadro mostra o erro que o REC-004 já traduz.
- O início não chama `connections.update`. `log_files` não ganha linha. Rótulo do quadro é o path (`label` nulo).
- Identidade ao vivo: mesma conexão e o mesmo path já normalizado. `~/app.log` e o absoluto correspondente são quadros diferentes, como no path gravado do REC-004. Vale para quadro no dock e para widget.
- O início pelo path e o início por `logFileId` usam essa identidade. Se já houver quadro daquele path, os dois só focam: no dock, a faixa rola até o quadro; no widget, a janela auxiliar vem para a frente. Não abre um segundo `tail`.
- A contagem do teto usa só quadros gravados (`ephemeral === false`). Oitavo gravado aberto ainda recusa o nono gravado. Um quadro da seleção abre mesmo com os 8 gravados abertos. Não há segundo teto.
- Quadro novo nasce no dock. Destacar e recolher continuam os do REC-004. Fechar chama `log-follows:stop` e não grava nada.
- Tentar de novo num quadro da seleção recarrega a conexão (nome e credencial) e mantém o path que está na memória. Não procura o id em `logFiles`. Conexão apagada ou que deixou de ser SSH falha com o código que o quadro já mostra.
- Apagar a conexão ou encerrar o app encerra este quadro junto com os gravados.
- Sem diálogo de confirmação e sem toast de sucesso. O quadro aberto é a resposta. Path inválido reusa o toast “Caminho inválido.”. `NOT_FOUND` e `NOT_SSH` usam os textos de `connection.logFollow.errors.*` e não abrem quadro.
- O rótulo novo entra nos 3 locales. O restante do menu continua fixo em português.
- Sem atalho, sem migration, sem coluna, sem mudança de import/export. O [ADR 0019](../../adr/0019-acompanhamento-log-ssh.md) segue valendo para a lista gravada. Este quadro não é metadado da conexão e não entra no export. Sem ADR novo.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | No terminal SSH de uma conexão salva, o menu de contexto mostra **Monitorar log**. Sem seleção, o item fica indisponível. | Alta |
| RF-02 | Fora de SSH, ou sem `connectionId`, o item não aparece. | Alta |
| RF-03 | Seleção que não passa em `normalizeLogFilePath` mostra aviso traduzido e não abre quadro. | Alta |
| RF-04 | Seleção com path aceito abre o quadro no dock, sem gravar o arquivo na conexão. | Alta |
| RF-05 | Se já existe quadro ao vivo da mesma conexão e do mesmo path normalizado, o clique só foca esse quadro. | Alta |
| RF-06 | O quadro da seleção não entra na contagem de 8. Com 8 quadros gravados abertos, este ainda abre. O nono gravado continua recusado. | Alta |
| RF-07 | Fechar o quadro encerra o `tail`. A lista **Arquivos de log** permanece como estava. | Alta |
| RF-08 | Rótulo e aviso nos 3 locales. | Alta |

## Requisitos técnicos

- **Shared:** `LogFollowStartInput` aceita o formato atual `{ connectionId, logFileId }` e o formato novo `{ connectionId, path }` sem `logFileId`. Os dois juntos são recusados. `normalizeLogFilePath` continua a única gramática. `LogFollowSnapshot.logFileId` passa a `string | null`. `ephemeral: boolean` entra no snapshot. Código novo `INVALID_PATH` em `LogFollowErrorCode`, só na recusa anterior ao quadro.
- **IPC:** o canal continua `log-follows:start`. Sem canal novo. O handler faz `safeParse` e delega: com `logFileId`, o `start` de hoje; com `path`, `startPath`. O main normaliza de novo e devolve `{ ok: false, code: 'INVALID_PATH' }` sem criar quadro.
- **Main:** `LogFollowService.startPath` cria o quadro com `ephemeral: true`, `logFileId: null`, `label: null` e o path normalizado. O `run` existente resolve `~`, cita o absoluto e executa `tail -n 200 -F --`. `start` conta só quadros com `ephemeral === false` antes de recusar com `LIMIT`. Os dois inícios, antes de criar, procuram quadro da mesma `connectionId` e do mesmo path normalizado; se acham, incrementam `focusNonce`, focam a janela ou a principal e devolvem `alreadyOpen: true`. `retry` de quadro efêmero não lê `logFiles`. `stop`, `stopConnection` e `disposeAll` já percorrem o mapa e passam a incluir este quadro.
- **Renderer:** terceiro callback em `sshActions` do `TerminalContextMenu`, depois de **Adicionar arquivo de log**, ícone Lucide `ScrollText` no tamanho do item de log. A decisão e o toast ficam no `TerminalView`. Sucesso é `logFollows.start({ connectionId, path })`. Não usar `connections.update`.
- **Dados:** nenhum. A coluna `log_files` não muda.
- **Segurança:** o path vem da tela e pode ter sido impresso pelo servidor. Não entra em shell solto: o main só executa o comando fixo do REC-004 com o path já normalizado. Credencial não sai do main. `INVALID_PATH` não leva a string rejeitada.

O renderer traduz `INVALID_PATH` com `connection.terminalSelection.invalidPath`. O código não aparece cru no quadro, porque o quadro não chega a ser criado.

## Interface / UX

Item no grupo de SSH, depois de **Adicionar arquivo de log**. Sem atalho e sem diálogo.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Ação | Monitorar log | Follow log | Seguir log |

Toast de path inválido: o texto que já existe (“Caminho inválido.” e os equivalentes). Conexão ausente ou que não é SSH: os textos de `connection.logFollow.errors.NOT_FOUND` e `NOT_SSH`.

O título do quadro é o path. Destacar, recolher, tentar de novo e fechar são os botões do REC-004.

## Critérios de aceite

- [x] Terminal SSH com conexão salva mostra **Monitorar log**. Sem seleção, o item fica indisponível. Telnet, shell local e sessão sem conexão não mostram.
- [x] Seleção `/var/log/app.log` abre o quadro no dock e a lista **Arquivos de log** da conexão continua igual.
- [x] `var/log`, `~outro`, seleção com quebra de linha e aspas em volta avisam e não abrem quadro. `~/app/app.log` abre como `~/app/app.log`.
- [x] Segundo clique no mesmo path, com o quadro no dock, não abre outro `tail`: a faixa mostra o quadro que já existe. Com o quadro destacado, a janela auxiliar vem para a frente.
- [x] **Acompanhar** num arquivo gravado cujo path já está num quadro da seleção só foca esse quadro.
- [x] Com 8 quadros gravados abertos, **Monitorar log** ainda abre. O nono **Acompanhar** de arquivo gravado continua recusado.
- [x] Fechar o quadro encerra o acompanhamento e não grava o path. Tentar de novo não exige linha em `logFiles`.
- [x] Rótulo e toasts em pt-BR, en e es.
- [x] Vitest cobre path inválido sem quadro, efêmero fora da contagem de 8, foco quando o path já está aberto e retry sem linha em `logFiles`.

## Fora de escopo

- Menu do painel SFTP ([REC-009](../rec-009-diretorio-e-monitoramento-sftp/especificacao.md)).
- Gravar o path em `logFiles` (isso é o REC-005).
- Traduzir Cortar, Copiar, Colar e o resto do menu.
- Tirar aspas da seleção.
- `stat` para recusar diretório.
- Confirmar `~/app.log` e `/home/…/app.log` como o mesmo arquivo.
- Teto próprio para quadros da seleção.
- Rótulo editável neste quadro.
- Migration, North Server, CSV, export.
- ADR novo.

## Documentação de produto

- Manual: extensão do capítulo `connect` nos 3 locales (parágrafo do menu de contexto do terminal SSH). Feito.
- What's new: fica para o bump da próxima versão. A tag `v0.1.46` já existe, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- Engenharia: a ação e o início pelo path em `docs/08-protocolos.md`. `docs/04-modelo-dados.md` não muda. Sem ADR.

## Resultado final

Entregue em 2026-10-31, homologado em 2026-11-02.

No menu de contexto do terminal SSH, **Monitorar log** abre o quadro do caminho selecionado sem gravar o arquivo em `logFiles` e sem ocupar uma das 8 vagas dos quadros gravados. Path inválido só avisa. Se esse caminho já está ao vivo, o clique traz o quadro para a frente. Fechar encerra o `tail`.

Na homologação, com ligaturas ligadas, o quadro derrubava a janela ([BUG-004](../../correcoes.md)). O xterm do painel passou a usar `allowProposedApi`, como o terminal da sessão.

Não há coluna nova. O what's new espera a próxima versão.

Arquivos principais: `src/shared/types/log-follow.ts`, `src/main/services/log-follow-service.ts`, `src/main/ipc/log-follows.ts`, `src/renderer/src/features/sessions/TerminalContextMenu.tsx`, `src/renderer/src/features/sessions/TerminalView.tsx`, `src/renderer/src/features/log-follow/LogFollowView.tsx`.
