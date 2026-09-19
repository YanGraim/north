# Agentes

A seção **Agentes** da sidebar gerencia workspaces de agentes de IA (Claude Code, Codex, ou qualquer CLI) rodando em git worktrees isoladas — não faz parte da hierarquia Cliente → Ambiente → Grupo → Conexão.

## Criar um workspace

**Novo workspace** (na sidebar ou no board) pede:

- **Repositório** — qualquer pasta com um repositório git, escolhida pelo seletor nativo. Não precisa estar cadastrada no North.
- **Branch** — nome da nova branch que será criada para a worktree.
- **Comando do agente** — texto livre (`claude`, `codex`, o que for).
- **Tarefa** (opcional) — uma nota curta sobre o que o agente está fazendo.

Ao criar, o North roda `git worktree add` dentro do repositório, criando a pasta em `<repositório>/.north/worktrees/<branch>`. A sessão abre automaticamente rodando o comando do agente ali dentro.

## Sessão e contexto

A sessão de um workspace é um terminal como qualquer outro (mesma aba, mesmo motor), mas com uma barra de contexto acima do terminal mostrando **repositório**, **branch** e a **tarefa** anotada — para não perder de vista qual agente/branch está aberto quando há várias sessões em paralelo.

## Board (Kanban)

O board nasce com 3 colunas (**Backlog**, **Em andamento**, **Concluído**), mas elas são totalmente suas:

- **+ Nova coluna** cria uma coluna com o nome que você quiser.
- Clique no nome de uma coluna pra renomear.
- Passe o mouse no cabeçalho da coluna pra ver o botão de excluir — excluir uma coluna não apaga os workspaces dela, eles só ficam em "Sem coluna" até você movê-los.
- Arraste os cards entre colunas livremente.

Um ponto verde no card indica que há uma sessão aberta agora pra aquele workspace; cinza indica que não há.

## Excluir um workspace

Excluir roda `git worktree remove` **sem `--force`**. Se houver alterações não commitadas na worktree, a remoção falha e nada é perdido — comite ou descarte as mudanças manualmente antes de tentar de novo.
