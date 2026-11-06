# REC-024 — Workflows na organização

- **Status:** 🧪 Em testes
- **Ideia de origem:** — (pedido direto do usuário, 2026-11-06)
- **Criado em:** 2026-11-06
- **Última atualização:** 2026-11-06
- **ADRs:** [0018](../../adr/0018-north-server-workspaces.md) (notas da Fase 9)

## Visão geral

Depois do REC-023, a organização já guardava conexões, bancos, logins e o modelo da VPN. Faltava:

1. **Workflows.** Workflows e variáveis de grupo ficavam só no Meu workspace. A cópia para a organização avisava "ficaram de fora".
2. **VPN no workflow.** Rodar um workflow de um cliente com VPN não subia a VPN, nem no Meu workspace.
3. **Quem atualizou.** O histórico de atualizações (rastreamento Git) não dizia quem rodou o workflow. Numa equipe isso é o controle principal.
4. **Equipes legíveis.** Dentro do North não dava para ver de quais equipes a pessoa faz parte. No painel admin, liberar vários itens exigia um por um.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | A organização guarda workflows (definição, ícone, conexão preferida) e variáveis de grupo. | Alta |
| RF-02 | Quem tem acesso ao grupo ou acima (Visualizador+) vê e roda os workflows; Editor e Admin criam, mudam e apagam. Quem só tem o caminho até uma conexão não vê os workflows do grupo. | Alta |
| RF-03 | O workflow roda no computador de quem clicou, com a conexão e a senha da organização. O histórico das execuções e as senhas de Git e sudo aprendidas ficam só neste computador. | Alta |
| RF-04 | Antes de abrir o SSH, o workflow (e a lista de tags Git do diálogo de parâmetros) sobe a VPN do cliente, como uma sessão; ao terminar, solta. Vale no Meu workspace e na organização. | Alta |
| RF-05 | Se a VPN ou o SSH falham antes do primeiro passo, o run termina como `failed` com o erro no primeiro passo (antes ficava rodando para sempre). | Alta |
| RF-06 | Uma atualização rastreada vai para o servidor com o usuário que rodou. A lista mostra "por Fulano"; quem pode ver a conexão vê a atualização. | Alta |
| RF-07 | "Copiar para workspace…" e "Copiar do Meu workspace…" levam os workflows e as variáveis do grupo, nos dois sentidos, com a conexão preferida remapeada. | Alta |
| RF-08 | `/me/access` devolve as equipes da pessoa; Configurações mostra papel, equipes e quantos itens foram liberados. | Média |
| RF-09 | No painel admin, a árvore de "Dar acesso" tem caixas de seleção, "Marcar todos os clientes" e "Liberar N"; o que está abaixo de um item marcado aparece incluído. | Média |
| RF-10 | A página de equipe sem grupo do Entra não mostra o texto "null". | Baixa |

## Requisitos não funcionais

- **Segurança:** o servidor nunca recebe as senhas de Git e sudo dos workflows; elas ficam no vault local. As variáveis de grupo são texto puro (como no Meu workspace), não lugar de senha.
- **Compatibilidade:** desktops anteriores ignoram `teams` e os campos novos; servidores anteriores fazem a tela de workflows da organização dar erro de "não encontrado", sem afetar o resto.
- **Multiplataforma:** nenhuma mudança específica de sistema; a VPN usa o mesmo `VpnGate` das sessões.

## Fora de escopo

- Execução no servidor (agendada ou centralizada).
- Histórico de execuções compartilhado (só as atualizações rastreadas vão para o servidor).
- Coleções de API na organização.
