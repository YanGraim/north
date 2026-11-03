# REC-005 — Diretório e log a partir da seleção do terminal

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-005
- **Criado em:** 2026-10-31
- **Última atualização:** 2026-10-31
- **ADRs:** —

## Visão geral

No menu de contexto do terminal de uma sessão SSH, duas ações usam o texto selecionado e gravam na conexão dona da sessão. **Definir diretório padrão** preenche o diretório inicial. **Adicionar arquivo de log** inclui o caminho na lista de logs acompanhados e abre o quadro. Sem seleção, as duas ficam indisponíveis.

Quem já vê o caminho na tela — um `ls`, um `pwd`, a saída de um deploy — deixa de copiar, abrir o cadastro e colar.

Os campos são os que já existem: `startupDirectory` ([REC-002](../rec-002-diretorio-padrao-ssh/especificacao.md)) e `logFiles` ([REC-004](../rec-004-acompanhamento-log-ssh/especificacao.md)). O [REC-008](../rec-008-monitorar-log-selecao/especificacao.md) é outra ação: acompanha sem gravar na conexão e fica de fora.

## Decisões

Herdadas da IDEIA-005:

- Seleção que é um arquivo, na ação de diretório, grava o diretório pai. `/var/www/html/portal/storage/logs/laravel-2026-10-31.log` vira `/var/www/html/portal/storage/logs`.
- A gravação vale para as próximas sessões e para a sessão aberta: `cd` no terminal, no caso do diretório, e o acompanhamento do arquivo, no caso do log.
- Se a conexão já tem diretório padrão, a troca pede confirmação.
- Sem seleção, caminho inválido ou sessão sem conexão SSH salva, nada é gravado.
- Os rótulos novos entram nos 3 locales. O restante do menu continua fixo em português.

Fechadas na spec:

- As ações só aparecem no terminal de uma conexão com protocolo `ssh`. Shell local, telnet, serial, agente e workflow não mostram os itens.
- A conferência arquivo/diretório é um `stat` SFTP num canal curto do `Client` SSH já autenticado. Nada é digitado no PTY para descobrir o tipo. Não abre outro login.
- O valor guardado é a seleção normalizada, não o `realpath`. `~/app/app.log` continua assim. Link simbólico: o `stat` segue o link só para classificar; o path gravado é o da seleção, e o pai também.
- Gramática do path: a de `normalizeLogFilePath` (absoluto POSIX ou `~` / `~/...`). Relativo, `~outro`, aspas em volta, quebra de linha e caractere de controle são recusados no cliente, sem ir ao servidor.
- Diretório: arquivo grava o pai; diretório grava o próprio path. `/` e `~` não sobem. Arquivo em `/app.log` grava `/`. Arquivo em `~/app.log` grava `~`.
- Log: só arquivo regular entra na lista, com rótulo `null`. Diretório, socket, fifo ou outro tipo não grava.
- Path ausente, SFTP indisponível ou `stat` que não seja “não existe”: toast traduzido e nada gravado. A mensagem crua do ssh2 não aparece.
- Diretório igual ao atual: não regrava e não pede confirmação; o terminal aberto ainda recebe o `cd`. Diretório vazio: grava sem diálogo. Diretório diferente: `AlertDialog` com o valor atual e o novo. Cancelar não grava e não faz `cd`.
- O `cd` sai só depois da gravação (ou quando o valor já era o mesmo), no PTY desta sessão: `cd -- ` + absoluto citado + Enter, o mesmo `startupCdCommand` do REC-002. O absoluto é o do diretório (pai, se a seleção era arquivo), com `~` resolvido por `realpath('.')` do SFTP. Um painel SFTP já aberto não se move. A próxima abertura de arquivos usa o campo novo.
- Log duplicado e o nono arquivo falham em `normalizeLogFileList`, com toast e sem quadro. Não há confirmação para incluir log. Sucesso chama `log-follows:start` com o id novo.
- O update é parcial: `{ startupDirectory }` ou a lista completa de `logFiles` (as atuais mais a nova). Não envia o restante da conexão.
- Um toast traduzido por ação. O toast genérico “Conexão atualizada” não entra junto.
- Sem atalho, sem migration, sem coluna nova, sem mudança de import/export.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | No terminal SSH de uma conexão salva, o menu de contexto mostra **Definir diretório padrão** e **Adicionar arquivo de log**. Sem seleção, os dois ficam indisponíveis. | Alta |
| RF-02 | Fora de SSH, ou sem `connectionId`, os dois itens não aparecem. | Alta |
| RF-03 | Seleção que não é caminho absoluto POSIX nem `~` / `~/...` mostra aviso traduzido e não grava. | Alta |
| RF-04 | **Definir diretório padrão** grava o diretório quando a seleção é diretório, ou o pai quando é arquivo, no campo **Diretório inicial**. | Alta |
| RF-05 | Se já existe um diretório inicial diferente, a troca só ocorre depois da confirmação. Cancelar não altera a conexão nem o terminal. | Alta |
| RF-06 | Depois de gravar (ou se o valor já era o mesmo), o terminal desta sessão recebe o `cd` citado do diretório. A sessão SFTP já aberta não muda de pasta. | Alta |
| RF-07 | **Adicionar arquivo de log** inclui o arquivo na lista da conexão e abre o quadro do REC-004. Diretório não entra na lista. | Alta |
| RF-08 | Path duplicado ou lista já com 8 arquivos não grava e não abre quadro. O aviso é traduzido. | Alta |
| RF-09 | Path ausente ou que não dê para conferir não grava, não faz `cd` e não abre quadro. | Alta |
| RF-10 | Rótulos novos, diálogo e toasts em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Shared:** `posixParent`, `planStartupDirectoryFromSelection` e `planLogFileFromSelection` em `src/shared/lib/selection-path.ts`. Reusam `canonicalPosixDir`, `normalizeStartupDirectory`, `normalizeLogFilePath` e `startupCdCommand`. Não criam outra gramática de path. Schema Zod do invoke no mesmo módulo ou ao lado, referenciado em `IpcInvokeMap`.
- **IPC:** canal novo `sessions:classify-path`. Args: `{ sessionId, path }`. Resultado: `{ kind: 'file' | 'directory' | 'other' | 'missing' | 'unavailable', path, absolute }`. `path` é a seleção já normalizada. `absolute` é esse path com `~` resolvido pelo login do SFTP (`realpath('.')`), sem `realpath` do alvo; `null` quando não houve `stat`. O main normaliza de novo e recusa path inválido antes de abrir o SFTP. Erro “não existe” vira `missing`. Qualquer outra falha de canal ou de `stat` vira `unavailable`, sem `error.message`.
- **Main:** `SshProtocolSession` ganha a classificação no `Client` já aberto: SFTP curto, `stat`, `end` no `finally`, no mesmo espírito de `applyStartupDirectory`. `ProtocolManager` só delega se a sessão for terminal SSH. Outro protocolo devolve `unavailable`. O `cd` não é responsabilidade deste canal: o renderer escreve no PTY com `sessions.write`, que já existe.
- **Renderer:** `TerminalView` lê a conexão (`useConnection`). Itens só com `protocol === 'ssh'`. O texto é `term.getSelection()` no clique, não um estado antigo. Decisão e toasts no `TerminalView`; o menu só dispara. Confirmação com `AlertDialog`, porque o menu fecha no `onSelect`. Update por `window.north.connections.update` com invalidação das queries da conexão. Não usar `useUpdateConnection` (ele mostra “Conexão atualizada”). Log: `crypto.randomUUID()`, lista inteira, depois `logFollows.start`.
- **Dados:** nenhum. Colunas `startup_directory` e `log_files` já existem. O schema de update já normaliza os dois campos.
- **Segurança:** o path vem da tela e pode ter sido impresso pelo servidor. Não entra em shell solto. Probe é `stat` no path já normalizado. O `cd` usa o absoluto citado. Credencial não sai do main. O resultado do classify não leva stderr.

O main não cria catálogo de i18n. O renderer traduz `kind` e os motivos de `normalizeLogFileList` (`duplicate`, `limit`).

## Interface / UX

Itens depois de Colar / Colar senha salva, com separador, ícone Lucide no tamanho do item de senha. Sem atalho.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Ação de diretório | Definir diretório padrão | Set default directory | Definir directorio predeterminado |
| Ação de log | Adicionar arquivo de log | Add log file | Añadir archivo de log |
| Título da confirmação | Trocar diretório padrão? | Replace default directory? | ¿Cambiar el directorio predeterminado? |

A descrição da confirmação mostra o path atual e o novo, em mono. Cancelar / Trocar (e os equivalentes).

Toasts curtos, traduzidos: gravou o diretório; o diretório já era esse (e o `cd` foi enviado); log incluído; path inválido; não é arquivo; não foi possível conferir; path não existe; duplicado; limite de 8. Nenhum deles repete mensagem de ssh2.

O campo no cadastro continua **Diretório inicial**. O menu fala “diretório padrão” porque é o nome da ação, não um segundo campo.

## Critérios de aceite

- [x] Terminal SSH com conexão salva mostra as duas ações. Sem seleção, as duas ficam indisponíveis. Telnet, shell local e sessão sem conexão não mostram.
- [x] Seleção `/var/www/app` que é diretório grava esse path. Seleção do arquivo de log do exemplo grava o pai `/var/www/html/portal/storage/logs`.
- [x] Com diretório inicial já preenchido e diferente, Cancelar não grava e o prompt não recebe `cd`. Confirmar grava e o terminal desta sessão entra no diretório.
- [x] Diretório inicial vazio grava sem diálogo. Valor igual ao atual não regrava e ainda envia o `cd`.
- [x] Arquivo de log selecionado entra na lista, o quadro do REC-004 abre, e o detalhe da conexão mostra o path. Diretório selecionado não entra na lista.
- [x] O nono arquivo e um path repetido não gravam e não abrem quadro.
- [x] `var/log`, `~outro`, seleção com quebra de linha e path que não existe não gravam. `~/app/app.log` grava como `~/app/app.log`.
- [x] Um path com espaço ou `'` no `cd` vai citado. A seleção não vira comando.
- [x] Painel SFTP já aberto não muda de pasta. A próxima abertura usa o diretório gravado.
- [x] Rótulos, diálogo e toasts em pt-BR, en e es.
- [x] Vitest cobre pai, arquivo → diretório, diretório → ele mesmo, recusa de log que não é arquivo, e o comando de `cd` citado.

## Fora de escopo

- [REC-008](../rec-008-monitorar-log-selecao/especificacao.md): acompanhar a seleção sem gravar em `logFiles`, fora do teto de 8.
- Traduzir Cortar, Copiar, Colar e o resto do menu.
- Tirar aspas da seleção (`'/var/log'` continua inválido).
- Mover um painel SFTP já aberto.
- Rótulo do arquivo de log pelo menu.
- Confirmação ao adicionar log.
- Heurística por extensão.
- `stat` ou `test` digitados no PTY.
- Migration, North Server, CSV, export.
- Catálogo de i18n no main.

## Documentação de produto

- Manual: extensão do capítulo `connect` nos 3 locales (seção do terminal SSH). Feito.
- What's new: fica para o bump da próxima versão. A tag `v0.1.46` já existe, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- Engenharia: as duas ações e o `stat` no cliente já aberto em `docs/08-protocolos.md`. `docs/04-modelo-dados.md` não muda. Sem ADR.

## Resultado final

Entregue em 2026-10-31, homologado sem ajuste de código.

No menu de contexto do terminal SSH, **Definir diretório padrão** grava `startupDirectory` (o pai, quando a seleção é um arquivo) e envia `cd -- ` citado nesta sessão. **Adicionar arquivo de log** acrescenta o arquivo em `logFiles` e abre o quadro do REC-004. Arquivo ou diretório sai de um `stat` SFTP no `Client` já aberto (`sessions:classify-path`); o PTY não recebe comando de conferência. Troca de um diretório já preenchido pede confirmação. Path inválido, ausente ou que não dê para conferir não grava.

Não há coluna nova. O what's new espera a próxima versão.

Arquivos principais: `src/shared/lib/selection-path.ts`, `src/main/protocols/ssh-driver.ts`, `src/main/services/protocol-manager.ts`, `src/main/ipc/sessions.ts`, `src/renderer/src/features/sessions/TerminalContextMenu.tsx`, `src/renderer/src/features/sessions/TerminalView.tsx`.
