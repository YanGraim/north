## Agentes

- **Gerenciador de agentes de IA:** nova seção "Agentes" na sidebar e um board Kanban com colunas 100% customizáveis (crie, renomeie e exclua colunas) para rodar Claude Code, Codex ou qualquer CLI de agente numa git worktree isolada, sem tocar no repo principal
- **Contexto sempre visível:** a sessão de um agente mostra repositório, branch e a tarefa anotada numa barra acima do terminal — fácil saber qual agente é qual quando há várias abas abertas
- Criar um workspace roda `git worktree add` automaticamente; excluir roda `git worktree remove` sem `--force` — se houver alterações não commitadas, nada é perdido

Ver o capítulo [Agentes](agents) no manual.
