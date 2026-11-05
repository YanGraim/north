# REC-014 — Editar arquivo remoto e enviar ao salvar

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-014
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

No painel remoto de SFTP e de FTP, um arquivo de texto pode ser editado no editor do North ou num editor instalado no computador. O North baixa o arquivo para uma pasta temporária. No editor interno, salvar devolve o conteúdo ao servidor. No editor externo, cada gravação da cópia local também devolve o arquivo. A cópia substitui o remoto. Fechar a sessão apaga o temporário e acaba o envio.

Quem corrige um config ou um script deixa de baixar, editar fora e enviar na mão. **Abrir** e o clique duplo que só baixam continuam como estão.

## Decisões

Herdadas da IDEIA-014:

- Fechar a sessão não espera o editor. O temporário é apagado e o envio automático acaba. A conexão não fica aberta por causa do editor.
- Vale para arquivo que um editor de texto abre. Pasta e binário ficam de fora.
- O envio substitui o arquivo no servidor. Se o original mudou no meio tempo, a cópia local ganha. Não há diálogo de conflito.

Fechadas na spec:

- **Editar** abre o editor interno. **Editar com…** abre um editor cadastrado. Os dois itens ficam no menu de contexto do painel remoto, com um único arquivo (`kind === 'file'`) selecionado. Pasta, link, outro tipo, seleção vazia ou vários itens deixam os dois indisponíveis.
- O painel local, o espelho da pasta do terminal e o clique duplo remoto não ganham esses itens. O clique duplo remoto continua baixando para a pasta local.
- O editor interno é uma aba de documento da sessão de arquivos, por cima dos dois painéis, com o caminho remoto no título. Não cria outra sessão nem outro protocolo. Várias abas podem coexistir na mesma sessão. Salvar é o botão da aba e Ctrl/Cmd+S. A aba marca alteração até o envio concluir.
- O editor externo não abre aba. O main grava o temporário, inicia o executável com `shell: false` e um único argumento: o caminho do temporário. O caminho remoto não entra na lista de argumentos. A observação vê data e tamanho da cópia, com uma espera curta, porque alguns editores gravam com outro nome e trocam o arquivo. Cada gravação estável dispara o upload.
- Binário é arquivo com byte nulo nos primeiros 8 KiB, ou maior que 8 MiB. Arquivo vazio é texto. Nesse caso o North apaga o temporário, avisa e não abre editor nem envia.
- A lista de editores fica em Configurações. Cada item tem nome e caminho do executável. A gravação é um JSON em `userData`, fora do SQLite e do import/export. O executável precisa ser um arquivo que já existe. O submenu **Editar com…** lista esses nomes; sem nenhum, o item fica indisponível.
- O upload desta edição sempre sobrescreve. Não passa pelo diálogo **Sobrescrever / Pular / Cancelar** da cópia entre painéis. Falha de envio avisa, mantém a aba ou a observação e não apaga o temporário, para a pessoa salvar de novo.
- Fechar a aba interna apaga o temporário daquele arquivo e para o envio dele. Alteração não salva some com a aba. Fechar a sessão faz o mesmo para todas as edições dela, internas e externas, e não segura a sessão até o processo do editor sair.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | No menu do painel remoto de SFTP e de FTP, **Editar** abre o arquivo de texto no editor interno. | Alta |
| RF-02 | **Editar com…** abre o mesmo arquivo no executável cadastrado. Cada gravação devolve o arquivo ao servidor. | Alta |
| RF-03 | Salvar no editor interno substitui o arquivo remoto. A aba deixa de marcar alteração quando o envio conclui. | Alta |
| RF-04 | Pasta, binário, arquivo acima de 8 MiB, seleção múltipla e o painel local não abrem editor nem enviam. | Alta |
| RF-05 | Em Configurações, a pessoa inclui e remove editores (nome e executável). Sem editor cadastrado, **Editar com…** fica indisponível. | Alta |
| RF-06 | Fechar a aba ou a sessão apaga o temporário e acaba o envio daquela edição. A sessão não permanece aberta por causa do editor. | Alta |
| RF-07 | **Abrir**, o clique duplo remoto e a cópia entre painéis continuam como hoje, inclusive o diálogo de conflito da cópia. | Alta |
| RF-08 | Falha de download, de envio ou de abertura do executável mostra um aviso curto. O detalhe do processo fica no log, sem o conteúdo do arquivo. | Alta |
| RF-09 | Rótulos do menu, da aba, dos avisos e da seção de Configurações em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Shared:** função pura que classifica o arquivo (`text` | `binary` | `too-large`) a partir do tamanho e de uma amostra. Função pura que monta o spawn: executável absoluto, argumento único com o temporário, `shell: false`, sem o caminho remoto. Schema Zod da lista de editores (`id`, `name`, `executable`).
- **IPC:** canais novos, sem reaproveitar o `fs:download` que abre o diálogo de salvar nem o `fs:upload` que pergunta conflito.
  - `fs:edit-open` — args `{ sessionId, remotePath, editorId: 'internal' | string }`. Resultado `{ ok: true, editId, remotePath, content?: string } | { ok: false, reason: 'not-file' | 'binary' | 'too-large' | 'unavailable' | 'editor-missing' }`. `content` só no editor interno.
  - `fs:edit-save` — args `{ sessionId, editId, content: string }`. Resultado `{ ok: true } | { ok: false, reason: 'unavailable' | 'closed' }`. Só o editor interno.
  - `fs:edit-close` — args `{ sessionId, editId }`. Resultado `void`.
  - `settings:list-external-editors` → `{ editors: ExternalEditor[] }`.
  - `settings:save-external-editors` — args `{ editors: ExternalEditor[] }`. Resultado `{ ok: true } | { ok: false, reason: 'invalid' | 'missing-executable' }`.
  - `settings:pick-executable` → `string | null`. Diálogo de arquivo que já existe no main, para o campo do executável.
  - Evento `fs:edit-uploaded` com `{ sessionId, editId, remotePath }` quando a observação externa envia com sucesso, para o toast. Evento `fs:edit-failed` com o mesmo corpo quando essa observação falha. O aviso é o de envio, sem o corpo do arquivo.
- **Main:** baixa para um diretório temporário do app, exclusivo da sessão e da edição. Classifica a amostra antes de abrir. No interno, devolve o texto. No externo, faz spawn e observa a cópia (data e tamanho estáveis depois de uma espera curta) e chama o upload com sobrescrita. Fechar a sessão ou `fs:edit-close` para a observação, apaga o temporário e não inicia envio novo. O conteúdo não entra em log.
- **Preload:** métodos no `NorthApi` para os canais acima e o evento de envio externo.
- **Renderer:** itens no menu remoto do `FilePane` (não no modo espelho). Abas de documento na `FileBrowserView`. Seção **Editores** em `SettingsPage`, com escolher executável pelo diálogo de arquivo que o main já oferece. Toasts i18n.
- **Dados:** nenhum no SQLite. A lista de editores fica em `userData`, no mesmo espírito de `window-prefs.json`. Não entra no import/export.
- **Segurança:** o spawn fica no main, sem shell e sem o caminho remoto nos argumentos. O renderer não recebe o caminho do executável para lançar processo. Credencial continua no vault. O texto do arquivo vai ao editor interno porque a pessoa vai lê-lo; não é segredo de vault e não vai para log.

## Interface / UX

Menu do painel remoto, um arquivo selecionado. Aba interna com caminho remoto, indicador de alteração e **Salvar**. Configurações ganham a seção **Editores**: nome, caminho, acrescentar, remover. Sem atalho novo além de Ctrl/Cmd+S na aba.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Menu | Editar | Edit | Editar |
| Menu | Editar com… | Edit with… | Editar con… |
| Aba, salvar | Salvar | Save | Guardar |
| Aviso, binário | Este arquivo não abre num editor de texto. | This file does not open in a text editor. | Este archivo no se abre en un editor de texto. |
| Aviso, grande | Este arquivo é grande demais para editar aqui. | This file is too large to edit here. | Este archivo es demasiado grande para editarlo aquí. |
| Aviso, envio | Não foi possível enviar o arquivo de volta. | Could not send the file back. | No se pudo enviar el archivo de vuelta. |
| Aviso, editor | Não foi possível abrir o editor. | Could not open the editor. | No se pudo abrir el editor. |
| Configurações | Editores | Editors | Editores |

O espelho da pasta do terminal permanece só com **Atualizar**.

## Critérios de aceite

- [x] No painel remoto, **Editar** abre um `.conf` ou `.sh` no editor interno. Salvar substitui o arquivo no servidor e a aba deixa de marcar alteração.
- [x] **Editar com…** abre o executável cadastrado. Gravar nesse editor substitui o remoto, sem perguntar se o original mudou.
- [x] Pasta, arquivo com byte nulo e arquivo acima de 8 MiB avisam e não abrem editor nem enviam.
- [x] Sem editor cadastrado, **Editar com…** fica indisponível. Incluir e remover em Configurações atualiza o submenu.
- [x] Fechar a aba ou a sessão apaga o temporário. Gravar no editor externo depois disso não envia, e a sessão não fica aberta à espera do editor.
- [x] Clique duplo e **Abrir** no remoto continuam baixando para a pasta local. A cópia entre painéis continua com o diálogo de conflito.
- [x] O painel local e o espelho da pasta do terminal não mostram **Editar**.
- [x] Vale em SFTP e em FTP.
- [x] Rótulos em pt-BR, en e es.
- [x] Vitest cobre a classificação (vazio é texto, nulo é binário, acima de 8 MiB recusa) e o plano de spawn (um argumento, sem shell, sem o caminho remoto).

## Fora de escopo

- Diff ou pergunta quando o remoto mudou no meio tempo.
- Editar pelo painel da pasta do terminal. O [REC-017](../rec-017-acoes-sftp-painel-terminal/especificacao.md) leva as outras ações de arquivo para esse painel e deixa o editor de fora.
- Caminho clicável e diretórios favoritos (IDEIA-015 e IDEIA-016).
- Argumentos extras no executável (`--wait` e semelhantes). A observação da cópia dispensa esperar o processo.
- Coloração por linguagem além do que o CodeMirror já usado no app permitir sem dependência nova.
- Manter a sessão aberta enquanto o editor externo estiver aberto.
- Migration, North Server, import/export da lista de editores.

## Documentação de produto

- Manual: extensão da seção **Arquivos (SFTP/FTP)** do capítulo `connect`, nos 3 locales. Escrita em 2026-11-04.
- What's new: fica para o bump da próxima versão. O app está em `0.1.47`, e o diálogo só mostra notas até a versão do app.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste de código.

No painel remoto de SFTP e de FTP, **Editar** abre um arquivo de texto no editor do North. **Salvar** substitui o arquivo no servidor. **Editar com…** abre um executável cadastrado em Configurações → Editores, e cada gravação devolve o arquivo, sem diálogo de conflito. Pasta, byte nulo nos primeiros 8 KiB e arquivo acima de 8 MiB avisam e não enviam. Fechar a aba ou a sessão apaga o temporário e o envio acaba. **Abrir** e o clique duplo continuam baixando. O painel local e o espelho da pasta do terminal não editam.

A lista de editores fica em `userData/external-editors.json`, fora do SQLite e do import/export. O spawn é no main, sem shell e com um único argumento, o temporário. O what's new espera a próxima versão.

Arquivos principais: `src/shared/lib/remote-edit.ts`, `src/main/services/file-transfer/remote-edit-service.ts`, `src/main/external-editors.ts`, `src/renderer/src/features/sessions/file-browser/RemoteEditSurface.tsx`, `src/renderer/src/features/settings/ExternalEditorsSection.tsx`.
