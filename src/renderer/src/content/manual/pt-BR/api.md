# Cliente API

A seção **APIs** da sidebar guarda collections HTTP. Não são Connections de servidor. Um Access **API** é só o ambiente (Base URL, auth padrão, variáveis). Só entra no seletor de ambiente (e no botão Conectar) quem tiver "Expor esta URL como variável de ambiente" marcado no cadastro — sem isso é só uma URL guardada.

## Global vs cliente

- **Globais** — `client_id` vazio, aparecem em qualquer lugar.
- **Cliente** — collections daquele cliente, só aparecem ali.

Cliente sem collections não aparece. Excluir um Access **não** apaga collections. Excluir um cliente apaga só as collections dele; as globais permanecem.

**O seletor de ambiente é independente disso.** Ele lista *todos* os Accesses API com a variável de ambiente ativada, de qualquer cliente — não precisa ser do mesmo cliente da collection aberta. O rótulo mostra `Cliente / Ambiente — nome` pra deixar claro de onde vem cada um.

## Abrir o estúdio

Clique numa collection na sidebar (não precisa de Conectar). **Conectar** num Access API abre o mesmo estúdio com aquele Access pré-selecionado como ambiente.

## Importar e exportar

O **+** da seção, a área vazia e a toolbar do estúdio importam **Postman Collection v2.1**. Escolha Global ou um cliente. Exporte no menu de contexto da collection. Segredos saem só como `{{var}}`.

## Enviar

URL absoluta (`https://…`) funciona sem ambiente. URL relativa precisa de um Access API no seletor (Base URL, auth, variáveis). O seletor lista Accesses `type: api` com a variável de ambiente ativada, de qualquer cliente — não as pastas HML/PROD do inventário, e não precisa bater com o cliente da collection.

**Sem ambiente** envia só com o que está na aba. **+ Novo ambiente** abre o formulário de Access com tipo API (e o cliente da collection, quando houver). Conectar num Access continua pré-selecionando aquele ambiente.

Segredos não saem do main. Sem Access, o envio não entra no histórico.

Não há timeout por padrão. Use **Cancelar** na barra de abas para abortar. Enquanto a request está em andamento, o painel de resposta mostra um spinner e o tempo decorrido; a resposta anterior fica escurecida atrás.

O corpo da resposta é limitado a 10 MB; acima disso ele é truncado. Nesse caso o toggle Pretty/Raw fica indisponível e o aviso ao lado mostra "truncado" (em vez de "não é JSON"), com o motivo no tooltip.

Com body do tipo JSON, o botão **Formatar** (acima do editor) reindenta o conteúdo colado ou digitado. O corpo da resposta e o corpo da request são editores de código completos — além do botão **Copiar** (copia tudo), dá pra selecionar qualquer trecho com o mouse e copiar só ele (⌘/Ctrl+C).

A busca em Collections filtra por nome, método, URL e pastas/collections. O Histórico filtra por método, URL e status. Fechar uma aba com edições não salvas pede para salvar, descartar ou ficar.

## Variáveis

Digite `{{` em URL, params, headers ou nos campos de Auth (Bearer, Basic, API Key) para ver um autocomplete com as variáveis do ambiente selecionado (mais `{{baseUrl}}`, sempre disponível quando há ambiente). `{{variavel}}` reconhecida aparece destacada em cor de acento; `{{variavel}}` desconhecida aparece sublinhada em vermelho.

## Presets

**Aplicar preset** e **Salvar como preset…** ficam nas abas Headers e Auth de uma request. Um preset guarda um conjunto de headers ou uma configuração de Auth — nunca os dois juntos — e é global: fica disponível em qualquer request, de qualquer collection ou cliente, sem depender de um ambiente. Salvar Auth como preset segue a mesma convenção do resto da definição da request: use templates `{{variavel}}` nos campos, nunca segredos literais.

## Atalhos

- **⌘/Ctrl+Enter** — Enviar
- **⌘/Ctrl+S** — Salvar request
- **⌘/Ctrl+L** — Focar URL
