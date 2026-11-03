# REC-009 — Diretório padrão e monitoramento no painel SFTP

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-009
- **Criado em:** 2026-11-02
- **Última atualização:** 2026-11-02
- **ADRs:** —

## Visão geral

No painel remoto de arquivos de uma conexão SSH, três ações usam o que já está na tela. Um botão na barra grava a pasta aberta como diretório inicial da conexão. No menu de contexto de um arquivo, **Adicionar ao monitoramento** inclui o caminho na lista de logs e abre o quadro. **Monitorar em tempo real** abre o quadro sem gravar o arquivo na conexão.

Quem já está em `/var/www/html/gruppe/storage/logs`, ou com `laravel.log` selecionado, deixa de abrir o cadastro para colar o caminho.

O diretório é o campo do [REC-002](../rec-002-diretorio-padrao-ssh/especificacao.md). **Adicionar ao monitoramento** grava e abre como o **Adicionar arquivo de log** do [REC-005](../rec-005-diretorio-log-selecao-terminal/especificacao.md). **Monitorar em tempo real** usa o início pelo path do [REC-008](../rec-008-monitorar-log-selecao/especificacao.md). O quadro continua o do [REC-004](../rec-004-acompanhamento-log-ssh/especificacao.md): `tail -F`, canal próprio, credencial só no main.

## Decisões

Herdadas da IDEIA-009:

- Se a conexão já tem diretório padrão, a troca pede confirmação, como no REC-005.
- **Monitorar em tempo real** fica só enquanto o quadro estiver aberto. Não entra em **Arquivos de log** e não conta no teto de 8 quadros gravados, como no REC-008.
- As três ações aparecem só no painel remoto de arquivos aberto a partir de uma conexão salva com protocolo `ssh`. FTP, conexão cujo protocolo não é `ssh` e o painel local ficam de fora.

Fechadas na spec:

- O botão fica na barra do painel remoto, no mesmo tamanho dos outros, antes do campo de caminho. É só ícone (`FolderInput`), com `aria-label` “Definir diretório padrão”. Sem atalho. Some quando não há conexão SSH salva. Fica indisponível enquanto o painel remoto ainda não tem pasta listada.
- O valor gravado é a pasta que o painel está listando, depois de `normalizeStartupDirectory`. O rascunho do campo de caminho, antes do Enter, não entra. A pasta de login, quando a barra mostra o absoluto, grava esse absoluto. Não vira `~`.
- A comparação é a string normalizada, a mesma do REC-005. `/var/log/` e `/var/log` são o mesmo valor. `~` e `/home/usuario` são diferentes e pedem confirmação.
- Diretório inicial vazio grava sem diálogo. Valor igual ao atual não regrava e avisa que já era esse. Valor diferente abre o mesmo `AlertDialog` do terminal, com o atual e o novo. Cancelar não grava. Confirmar grava só `{ startupDirectory }`.
- O update é `connections.update` com invalidação das queries da conexão. Não usar `useUpdateConnection`. Um toast da ação. O toast “Conexão atualizada” não entra junto.
- Caminho que `normalizeStartupDirectory` recusa (relativo, `~outro`, caractere de controle) avisa e não grava. O painel continua na pasta em que está.
- Esta ação não escreve no PTY e não chama `sessions:classify-path`. O painel já está na pasta. Um terminal já aberto não recebe `cd`. A próxima sessão SSH e a próxima abertura de arquivos usam o campo pelo REC-002.
- Os dois itens de log ficam no menu do painel remoto SSH, depois de **Abrir**, com separador. Ícones `FilePlus` e `ScrollText`. Ficam indisponíveis quando a seleção não é exatamente um item com `type === 'file'`: pasta, link, outro tipo, seleção vazia ou mais de um item. No painel local, no FTP e sem conexão SSH, os itens não aparecem.
- O tipo vem da listagem. Não há `stat` novo. Link simbólico não conta como arquivo.
- **Adicionar ao monitoramento** usa `entry.path`, já absoluto (`posix.join` da listagem), em `planLogFileFromSelection` com `kind: 'file'` e rótulo `null`. Duplicata e o nono arquivo avisam, não gravam e não abrem quadro. Sucesso grava a lista inteira e então chama `log-follows:start` com o id novo. Se o start falhar depois da gravação, a lista permanece e o toast diz que o quadro não abriu, como no REC-005. Sem diálogo para incluir log.
- **Monitorar em tempo real** chama `log-follows:start` com `{ connectionId, path }`. Não chama `connections.update`. Se esse path já está ao vivo na mesma conexão, o clique só traz o quadro para a frente. Path inválido avisa e não abre quadro. Sem toast de sucesso: o quadro aberto é a resposta. Fechar encerra o `tail` e não grava o path. O quadro não entra na contagem de 8.
- Os rótulos novos entram nos 3 locales. O restante do menu de arquivos continua fixo em português.
- Sem atalho, sem migration, sem canal IPC novo, sem coluna, sem mudança de import/export. O [ADR 0019](../../adr/0019-acompanhamento-log-ssh.md) segue valendo para a lista gravada. O quadro de **Monitorar em tempo real** não é metadado da conexão e não entra no export. Sem ADR novo.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | No painel remoto de arquivos de uma conexão SSH salva, a barra tem o botão **Definir diretório padrão**. | Alta |
| RF-02 | O botão grava a pasta listada em **Diretório inicial**. Vazio grava sem diálogo. Igual ao atual não regrava. Diferente só grava depois da confirmação. Cancelar não altera a conexão. | Alta |
| RF-03 | FTP, protocolo que não é `ssh`, sessão sem `connectionId` e o painel local não mostram o botão nem os itens de log. | Alta |
| RF-04 | No menu do painel remoto SSH, **Adicionar ao monitoramento** e **Monitorar em tempo real** ficam indisponíveis quando a seleção não é exatamente um arquivo. | Alta |
| RF-05 | **Adicionar ao monitoramento** inclui o arquivo na lista da conexão e abre o quadro do REC-004. Duplicata e o nono arquivo não gravam e não abrem quadro. | Alta |
| RF-06 | **Monitorar em tempo real** abre o quadro sem gravar o arquivo. Não conta no teto de 8. Se o arquivo já está ao vivo, o clique só foca o quadro. | Alta |
| RF-07 | Caminho recusado por `normalizeStartupDirectory` ou `normalizeLogFilePath` avisa e não grava nem abre quadro. | Alta |
| RF-08 | Rótulos novos, diálogo e toasts em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Shared:** `planStartupDirectoryFromPane({ path, current })` em `src/shared/lib/selection-path.ts`. Devolve `invalid`, ou `{ stored, unchanged, needsConfirm }`. Reusa `normalizeStartupDirectory`. Não devolve comando de `cd`. O log reusa `planLogFileFromSelection` com `kind: 'file'`. Sem gramática nova de path.
- **IPC:** nenhum canal novo. Diretório e lista usam `connections.update`. O ao vivo usa `log-follows:start`, no formato `{ connectionId, logFileId }` ou `{ connectionId, path }` que o REC-008 já aceita.
- **Main:** nenhuma mudança de serviço. A normalização de `startupDirectory` e de `logFiles` no update, e o `start` / `startPath` do acompanhamento, continuam os de hoje.
- **Renderer:** `FileBrowserView` lê a conexão (`useConnection`) e só habilita as ações com `protocol === 'ssh'`. O botão e o diálogo ficam no fluxo do painel remoto. O menu de `FilePane` recebe os callbacks; a decisão e os toasts ficam no `FileBrowserView`, porque o menu fecha no `onSelect`. O diálogo reusa o `AlertDialog` e as chaves `connection.terminalSelection.confirm*`. Update parcial e invalidação das queries, no mesmo espírito de `persistStartupDirectory` do `TerminalView`.
- **Dados:** nenhum. Colunas `startup_directory` e `log_files` já existem.
- **Segurança:** o path é o da listagem SFTP da sessão que a pessoa já abriu, não texto livre do servidor. Não entra em shell solto. O `tail` continua o comando fixo do REC-004, com o path normalizado no main. Credencial não sai do main.

O renderer traduz path inválido, duplicata, limite e falha de gravação com as chaves que o REC-005 já usa. `NOT_FOUND` e `NOT_SSH` usam `connection.logFollow.errors.*`.

## Interface / UX

Botão só no painel remoto SSH, antes do campo de caminho. Itens de log depois de **Abrir**. Sem atalho.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Botão (`aria-label`) | Definir diretório padrão | Set default directory | Definir directorio predeterminado |
| Gravar e acompanhar | Adicionar ao monitoramento | Add to monitoring | Añadir al monitoreo |
| Só acompanhar | Monitorar em tempo real | Monitor live | Monitorear en tiempo real |

O diálogo de troca reusa o título, os rótulos e os botões de `connection.terminalSelection` (“Trocar diretório padrão?” e os equivalentes). Os paths vão em mono.

Toasts reusam os do terminal: diretório gravado, diretório que já era esse, arquivo de log adicionado, caminho inválido, duplicata, limite de 8, falha ao gravar, arquivo gravado sem quadro. **Monitorar em tempo real** não tem toast de sucesso.

O campo no cadastro continua **Diretório inicial**. O botão fala “diretório padrão” porque é o nome da ação, não um segundo campo.

## Critérios de aceite

- [x] Painel remoto de uma conexão SSH salva mostra o botão. Painel local, FTP e sessão sem conexão SSH não mostram o botão nem os itens de log.
- [x] Com **Diretório inicial** vazio, o botão na pasta `/var/www/html/gruppe/storage/logs` grava esse path sem diálogo.
- [x] Com diretório inicial já preenchido e diferente, Cancelar não grava. Confirmar grava. Valor igual, inclusive com barra no fim, não regrava e avisa.
- [x] Um terminal SSH já aberto não recebe `cd`. A próxima abertura de arquivos usa a pasta gravada.
- [x] Com um arquivo selecionado, **Adicionar ao monitoramento** inclui o path na lista e abre o quadro. Pasta, link, vários itens ou clique sem arquivo deixam os dois itens indisponíveis.
- [x] Path duplicado e o nono arquivo não gravam e não abrem quadro.
- [x] **Monitorar em tempo real** abre o quadro e a lista **Arquivos de log** continua igual. Segundo clique no mesmo path não abre outro `tail`. Com 8 quadros gravados abertos, este ainda abre.
- [x] Fechar o quadro de **Monitorar em tempo real** encerra o acompanhamento e não grava o path.
- [x] Rótulos, diálogo e toasts em pt-BR, en e es.
- [x] Vitest cobre pasta inválida, valor igual, valor vazio e troca que precisa de confirmação em `planStartupDirectoryFromPane`.

## Fora de escopo

- [REC-010](../rec-010-arquivos-do-diretorio-atual/especificacao.md): lista da pasta do terminal ao lado do xterm.
- Traduzir Baixar, Abrir, Renomear, Nova pasta, Atualizar e Excluir.
- Conexão com protocolo `sftp` ou `ftp` que não seja o arquivo aberto a partir de SSH.
- `cd` num terminal já aberto.
- Seguir link simbólico para tratar o alvo como arquivo.
- Rótulo do arquivo de log pelo menu.
- Confirmação ao adicionar log.
- `stat` ou `sessions:classify-path` para um item que a listagem já classificou.
- Migration, North Server, CSV, export.
- ADR novo.

## Documentação de produto

- Manual: extensão do capítulo `connect` (seção Arquivos) nos 3 locales. Feito.
- What's new: fica para o bump da próxima versão. O app está em `0.1.46`, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- Engenharia: as três ações em `docs/08-protocolos.md`. `docs/04-modelo-dados.md` não muda. Sem ADR.

## Resultado final

Entregue em 2026-11-02, homologado no mesmo dia, sem ajuste de código.

No painel remoto de arquivos de uma conexão SSH salva, o botão **Definir diretório padrão** grava a pasta listada em `startupDirectory`. Diretório vazio grava na hora. Valor igual não regrava. Valor diferente pede confirmação. **Adicionar ao monitoramento** inclui o arquivo em `logFiles` e abre o quadro do REC-004. **Monitorar em tempo real** abre o quadro pelo path, sem gravar a lista e sem ocupar uma das 8 vagas. Pasta, link, seleção múltipla, FTP e o painel local não executam essas ações. Um terminal já aberto não recebe `cd`.

Não há coluna nova. O what's new espera a próxima versão.

Arquivos principais: `src/shared/lib/selection-path.ts`, `src/renderer/src/features/sessions/FileBrowserView.tsx`, `src/renderer/src/features/sessions/file-browser/FilePane.tsx`.
