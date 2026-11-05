# REC-016 — Diretórios favoritos no painel de arquivos

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-016
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

No painel remoto de SFTP e de FTP, a pessoa guarda pastas da conexão aberta e volta a qualquer uma com um clique. O favorito é o caminho (`/var/www/html`, `/etc/apache2/sites-enabled`). Acrescentar grava a pasta que o painel está listando. Remover tira só esse caminho da lista. Um clique lista a pasta, se ela ainda existir.

A lista é da conexão, não da sessão. Outra conexão não a vê. Duplicar a conexão, copiar o workspace, exportar o inventário e sincronizar não levam esses caminhos. O diretório inicial da conexão, o painel local e o espelho da pasta do terminal continuam como estão.

Não é a estrela de conexão favorita (`connections:toggle-favorite`).

## Decisões

Herdadas da IDEIA-016:

- A lista é só da conexão ativa. Não há favoritos compartilhados entre conexões.
- Por hora, os diretórios salvos não são compartilhados de nenhuma maneira: nem com outra conexão, nem na exportação, nem em sincronização.

Fechadas na spec:

- O botão fica na barra do painel remoto, no mesmo tamanho dos outros, com ícone `Bookmark` e `aria-label` “Diretórios favoritos”. Sem atalho. Só aparece quando o painel remoto tem `connectionId` (SFTP ou FTP de conexão salva). O painel local e o espelho da pasta do terminal não têm o botão.
- O menu lista os caminhos na ordem em que foram acrescentados, o mais antigo no topo. Cada linha é o caminho em fonte mono. O clique na linha abre essa pasta. Um botão na linha remove só aquele caminho, sem diálogo. Lista vazia mostra um texto curto e a ação de acrescentar.
- Acrescentar grava a pasta que o painel já está listando, depois de `normalizeStartupDirectory`. O rascunho do campo de caminho, antes do Enter, não entra. A pasta de login, quando a barra mostra o absoluto, grava esse absoluto. Não vira `~`.
- `/var/www/` e `/var/www` são o mesmo favorito. O segundo acrescentar não grava de novo e avisa que a pasta já está na lista. Caminho que `normalizeStartupDirectory` recusa (relativo, `~outro`, caractere de controle, acima do tamanho máximo) avisa e não grava.
- O clique lista primeiro com o `source.list` que o painel já usa. Só então chama `changePath`. Se a listagem falha, vale o aviso que a listagem já mostra e a pasta atual do painel não muda.
- A gravação não usa `connections.update` e não dispara o toast “Conexão atualizada”. Não altera `startup_directory`.
- Sem teto de quantidade. Sem reordenar e sem renomear o favorito: o rótulo é o caminho.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | No painel remoto de SFTP e de FTP de uma conexão salva, dá para acrescentar a pasta listada aos favoritos dessa conexão. | Alta |
| RF-02 | O menu mostra os caminhos dessa conexão, na ordem em que foram salvos. Um clique lista a pasta. | Alta |
| RF-03 | Remover tira o caminho da lista e não apaga nada no servidor. | Alta |
| RF-04 | A mesma pasta normalizada não entra duas vezes. Caminho recusado por `normalizeStartupDirectory` não grava. | Alta |
| RF-05 | Se a pasta não existe mais, o clique avisa e o painel continua na pasta atual. | Alta |
| RF-06 | Outra conexão, a duplicata, a cópia de workspace, o export do inventário e a sincronização não recebem a lista. | Alta |
| RF-07 | O painel local, o espelho da pasta do terminal e o diretório inicial da conexão não mudam. | Alta |
| RF-08 | Rótulos novos em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Dados:** migration `022`, tabela `connection_directory_favorites` (`id`, `connection_id`, `path`, `position`). Único por `(connection_id, path)`. Sem foreign key: a conexão de uma organização não está no SQLite pessoal, e a lista fica nesta máquina. Um trigger `AFTER DELETE ON connections` apaga as linhas quando a conexão local some. O delete da conexão também apaga pelo id. Não é coluna de `connections`. Sem backfill.
- **Main:** repositório lista, acrescenta e remove. Acrescentar normaliza com `normalizeStartupDirectory` e recusa o que não for absoluto seguro. Duplicata normalizada não insere outra linha. `connections.duplicate`, `buildInventoryExport` e `workspace-copy` não leem a tabela.
- **IPC:** `connections:list-directory-favorites`, `connections:add-directory-favorite`, `connections:remove-directory-favorite`. Args e result em `IpcInvokeMap`, método em `NorthApi`, handler no main, `invoke` no preload. O renderer não grava no SQLite.
- **Renderer:** menu no `FilePane` remoto quando há `connectionId` e `mirror` é falso. Acrescentar usa o `path` já listado. Abrir chama `source.list` e só então `changePath`.
- **Segurança:** o caminho é metadado da conexão, não segredo. A validação é no main, a mesma do diretório inicial. O clique não interpola o caminho num shell. Não há superfície de rede nova.

## Interface / UX

O botão fica na barra do painel remoto, junto dos outros botões só-ícone. O menu abre para baixo. Caminho longo corta com reticências; o `title` mostra o caminho inteiro.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Botão do menu | Diretórios favoritos | Favorite directories | Directorios favoritos |
| Acrescentar a pasta atual | Adicionar pasta atual | Add current directory | Agregar directorio actual |
| Lista vazia | Nenhum diretório favorito | No favorite directories | Ningún directorio favorito |
| Remover | Remover | Remove | Quitar |
| Já estava na lista | Esta pasta já é um favorito | This directory is already a favorite | Este directorio ya es un favorito |
| Caminho recusado | Não foi possível salvar este caminho | This path could not be saved | No se pudo guardar esta ruta |

Não há atalho. Não há diálogo de confirmação para acrescentar nem para remover.

## Critérios de aceite

- [x] No SFTP de uma conexão salva, em `/var/www/html`, acrescentar e reabrir o menu mostra esse caminho. O clique volta a listar `/var/www/html` depois de ter ido a outra pasta.
- [x] Remover tira o caminho do menu. O diretório no servidor continua.
- [x] Acrescentar `/var/www/` com `/var/www` já salvo não cria outra linha e avisa.
- [x] Um caminho relativo não grava.
- [x] Um favorito cuja pasta não existe mais avisa e o painel fica na pasta que já estava listando.
- [x] A outra conexão não mostra esses caminhos. Duplicar a conexão cria a cópia sem a lista.
- [x] O export do inventário não contém os caminhos. O diretório inicial da conexão não muda.
- [x] O painel local e o espelho da pasta do terminal não mostram o botão.
- [x] O mesmo fluxo vale no FTP.
- [x] Rótulos em pt-BR, en e es.

## Fora de escopo

- Favorito compartilhado entre conexões, grupo, cliente ou ambiente.
- Incluir a lista no import/export, na cópia de workspace, na duplicata ou na sincronização.
- Reordenar, renomear ou dar outro rótulo que não seja o caminho.
- Painel local, espelho da pasta do terminal e diretório inicial.
- Atalho de teclado.

## Documentação de produto

- Manual: extensão do capítulo `connect`, seção Arquivos (SFTP/FTP), nos 3 idiomas. Feito na implementação.
- What's new: sim, na próxima versão. A 0.1.47 já está publicada; a nota entra no bump.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste de código.

No painel remoto de SFTP e de FTP, **Diretórios favoritos** guarda a pasta listada só naquela conexão. Um clique lista a pasta de novo. Se ela não existir, o aviso aparece e o painel fica onde está. Remover só tira o caminho da lista. Duplicar a conexão, copiar o workspace, exportar e sincronizar não levam a lista. O painel local e o espelho da pasta do terminal não têm o botão.

A tabela `connection_directory_favorites` não tem foreign key, para a conexão de uma organização também poder gravar favorito nesta máquina. Um trigger apaga as linhas quando a conexão local some.

Arquivos principais: `src/main/database/migrations/022-connection-directory-favorites.ts`, `src/main/repositories/connection-directory-favorites-repository.ts`, `src/renderer/src/features/sessions/file-browser/DirectoryFavoritesMenu.tsx`.
