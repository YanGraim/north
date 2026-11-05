# REC-022 — Equipes e acesso por conexão no North Server

- **Status:** 🧪 Em testes
- **Ideia de origem:** IDEIA-022
- **Criado em:** 2026-11-05
- **Última atualização:** 2026-11-05
- **ADRs:** [0018](../../adr/0018-north-server-workspaces.md) (notas da Fase 7)

## Visão geral

A issue pedia uma instância por empresa, login com o Entra, área de gestão com cadastro, bloqueio e revogação imediata, acesso por usuário **ou grupo**, papéis e a lista de quem acessa cada projeto. As Fases 0 a 6 do ADR 0018 já entregavam quase tudo. Faltavam duas coisas, além de um painel melhor:

1. **Acesso a uma conexão só.** O menor nível de liberação era o grupo. Para liberar um único SSH, o gestor precisava criar um grupo só para ele.
2. **Equipes.** A liberação era por pessoa.

O painel admin foi refeito no visual do North, com menu lateral e uma página para cada pessoa e para cada equipe.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | O admin libera um cliente, um ambiente, um grupo **ou uma conexão** como Editor ou Visualizador. | Alta |
| RF-02 | Quem recebe só uma conexão vê essa conexão e o caminho até ela (cliente, ambiente e grupo, só para leitura). As outras conexões do grupo continuam ocultas. | Alta |
| RF-03 | Um Visualizador da conexão conecta com a senha salva, mas não lê nem cola a senha. Um Editor da conexão edita a conexão e lê a senha. Ele não cria conexões no grupo e não duplica. | Alta |
| RF-04 | O admin cria, renomeia e exclui equipes e adiciona ou remove membros. | Alta |
| RF-05 | Uma liberação dada à equipe vale para todos os membros. Ao sair da equipe, a pessoa perde o acesso na hora (evento `access.changed`). | Alta |
| RF-06 | Entre a liberação própria e as das equipes, vale a mais forte. | Alta |
| RF-07 | A equipe pode ter um ID de grupo do Entra. Se o login traz a claim `groups`, a pessoa entra nas equipes ligadas a esses grupos e sai das outras equipes ligadas. Quem foi adicionado à mão não sai. Sem a claim `groups`, nada muda. | Média |
| RF-08 | O painel tem Visão geral, Pessoas (busca e filtros, página da pessoa com equipes e todos os acessos, inclusive os herdados de equipe), Equipes, Projetos (árvore até a conexão, com busca) e Auditoria (filtro por tipo). | Alta |
| RF-09 | Todas as mudanças de equipe entram na auditoria. | Alta |
| RF-10 | Um desktop de versão anterior continua funcionando com o servidor novo. | Alta |

## Requisitos técnicos

- **Servidor — migration 008:**
  - Novas tabelas `teams` e `team_members`. Em `team_members`, `source` vale `manual` ou `entra`.
  - `project_grants` foi recriada:
    - `user_id` ou `team_id` (exatamente um preenchido);
    - nova coluna `connection_id`;
    - `scope_type` passa a aceitar `connection`;
    - índices únicos parciais por pessoa e por equipe.
  - As liberações já existentes são copiadas para a tabela nova.
- **Servidor — `AccessView`:**
  - A árvore carregada inclui as conexões.
  - O `level` sobe de conexão até cliente.
  - `listGrants` junta as liberações da pessoa com as de cada equipe dela (`mergeGrants` mantém a mais forte).
  - `requireConnection` recebe o id da conexão.
- **API admin:**
  - `PUT` e `DELETE /admin/grants` aceitam `userId` **ou** `teamId`.
  - Novos endpoints: `GET`, `POST`, `PATCH` e `DELETE /admin/teams`, `PUT /admin/teams/:id/members`, `DELETE /admin/teams/:id/members/:userId`.
  - `GET /admin/users` passa a trazer `teamIds`.
- **`/me/access`:**
  - As liberações de conexão vêm em `connectionGrants`, separadas das outras. O `grants` continua só com cliente, ambiente e grupo.
  - Motivo: o desktop anterior valida `scopeType` com um enum fechado, e o Zod descarta a chave nova.
- **Desktop:**
  - `WorkspaceAccessSchema.connectionGrants` tem `default([])`.
  - `ProjectPath.connectionId` alimenta `edit` e `revealPassword`.
- **Painel:**
  - `server/admin/admin.{js,css}`, sem build e com DOM montado à mão.
  - IBM Plex servida localmente: `plex-*.woff2`, na lista fechada de `admin-panel.ts`.
  - Ícones Lucide desenhados em SVG.
  - Rotas por hash (`#/people/<id>`).
- **Segurança:**
  - Nenhum segredo novo.
  - Leitura de senha continua pela regra do papel, com auditoria.
  - A CSP do painel não mudou: as fontes vêm de `'self'`.

## Critérios de aceite

- Os testes em `server/src/rbac.test.ts` (blocos "one connection" e "teams") e em `oidc.test.ts` ("Entra groups → teams") passam, junto com o teste da migration 008.
- `playwright/admin-panel.spec.ts` cobre: liberar uma conexão, a herança na tela de projetos, equipe com membro e liberação, e remover alguém da equipe.
- Um desktop 0.1.48 conectado ao servidor novo continua abrindo a organização.
