## Agentes

- **Gerenciador de agentes de IA:** nova seção "Agentes" na sidebar e um board Kanban com colunas 100% customizáveis (crie, renomeie e exclua colunas) para rodar Claude Code, Codex ou qualquer CLI de agente numa git worktree isolada, sem tocar no repo principal
- **Contexto sempre visível:** a sessão de um agente mostra repositório, branch e a tarefa anotada numa barra acima do terminal — fácil saber qual agente é qual quando há várias abas abertas
- Criar um workspace roda `git worktree add` automaticamente; excluir roda `git worktree remove` sem `--force` — se houver alterações não commitadas, nada é perdido

Ver o capítulo [Agentes](agents) no manual.

## Terminal

- **Colar senha salva:** no menu de contexto do terminal, cole direto a senha (ou senha de sudo) já salva na conexão — sem depender do clipboard do sistema, útil para `sudo su` quando colar do jeito normal falha

Ver o capítulo [Conectar](connect) no manual.

## Workflows

- **Rastreamento Git em workflows:** ative o rastreamento num workflow (caminho do repositório no servidor) e o North passa a registrar sozinho, a cada execução, quais commits entraram, quantos arquivos mudaram e se deu certo ou falhou — sem mudar em nada o que o workflow faz
- **Histórico de atualizações por ambiente:** widget "Últimas atualizações" no Dashboard (visão global, todos os clientes/ambientes) e uma versão filtrada no painel de cada conexão — quantas atualizações hoje/na semana, gráfico por semana e linha do tempo expansível com os commits de cada uma

Ver o capítulo [Workflows](workflows) no manual.
