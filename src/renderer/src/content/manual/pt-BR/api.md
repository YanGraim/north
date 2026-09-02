# Cliente API

A seção **APIs** da sidebar guarda collections HTTP. Não são Connections de servidor. Um Access **API** é só o ambiente (Base URL, auth padrão, variáveis).

## Global vs cliente

- **Globais** — `client_id` vazio. O seletor de ambiente lista todos os Accesses API.
- **Cliente** — collections daquele cliente; o seletor lista só os Accesses API dele, no formato `HML — teste`.

Cliente sem collections não aparece. Excluir um Access **não** apaga collections. Excluir um cliente apaga só as collections dele; as globais permanecem.

## Abrir o estúdio

Clique numa collection na sidebar (não precisa de Conectar). **Conectar** num Access API abre o mesmo estúdio com aquele Access pré-selecionado como ambiente.

## Importar e exportar

O **+** da seção, a área vazia e a toolbar do estúdio importam **Postman Collection v2.1**. Escolha Global ou um cliente. Exporte no menu de contexto da collection. Segredos saem só como `{{var}}`.

## Enviar

Escolha um ambiente antes de Enviar. URL, auth padrão e variáveis vêm do Access selecionado (`accesses.url` é `{{baseUrl}}`). Segredos não saem do main.

Não há timeout por padrão. Use **Cancelar** na barra de abas para abortar. Enquanto a request está em andamento, o painel de resposta mostra um spinner e o tempo decorrido; a resposta anterior fica escurecida atrás.

A busca em Collections filtra por nome, método, URL e pastas/collections. O Histórico filtra por método, URL e status. Fechar uma aba com edições não salvas pede para salvar, descartar ou ficar.

## Atalhos

- **⌘/Ctrl+Enter** — Enviar
- **⌘/Ctrl+S** — Salvar request
- **⌘/Ctrl+L** — Focar URL
