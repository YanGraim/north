# ADR 0018 — North Server (self-hosted) e workspaces

- **Status:** Proposto
- **Data:** 2026-10-20

## Contexto

Empresas querem uma instância própria que centralize projetos, usuários e permissões, com login corporativo (Microsoft Entra ID), área de administração e revogação imediata. Hoje o North é local-first (SQLite + `safeStorage`) e não tem conceito de usuário nem de organização.

## Decisões

1. **Modelo Hoppscotch:** o North Server é um pacote self-hosted (`docker compose`: API + Postgres + painel admin web), instalado pela empresa na própria infraestrutura. É um produto separado, distribuído como imagem.
2. **Mesmo app desktop:** não haverá um "app cliente" separado. O Electron ganha **workspaces**: *Pessoal (local)* e N *Organizações* (URL do servidor + login).
3. **Workspaces isolados:** um seletor no topo da sidebar alterna entre eles. Árvore, favoritos, recentes, histórico, busca e abas são próprios de cada workspace. A rota passa a ser `/w/:workspaceId/...`, e as query keys do TanStack Query incluem o `workspaceId`.
4. **Sem sync entre workspaces:** uma edição no Local fica no Local, e uma edição na Organização vai direto para o servidor, com push em tempo real via WebSocket. Itens só passam de um workspace para outro pela ação explícita **Copiar para workspace…**, que cria um item novo e sem vínculo.
5. **Servidor = plano de controle:** inventário, RBAC, auditoria e segredos. As sessões SSH/RDP/VNC/SFTP/SQL continuam saindo do desktop direto para o host. Um gateway/bastion fica para uma fase futura opcional.
6. **Auth:** Entra ID via OIDC + PKCE com redirect loopback no desktop. Os grupos do Entra são mapeados para papéis. O access token dura 5–10 min, o refresh token é revogável, e a revogação é empurrada por WebSocket e encerra as sessões abertas.
7. **Papéis**, atribuídos por projeto (Client/Environment/Group). Admin é global no workspace:

   | Ação | Admin | Editor | Visualizador |
   |---|---|---|---|
   | Gerenciar usuários, grupos do Entra e acesso a projetos; ver quem acessa cada projeto | ✅ | ❌ | ❌ |
   | Criar/editar/excluir conexões, accesses, workflows, variáveis | ✅ | ✅ | ❌ |
   | Abrir sessões / rodar workflows | ✅ | ✅ | ✅ |
   | Revelar senha | ✅ | ✅ | ❌ |
   | Auditoria | ✅ | ❌ | ❌ |

   A autorização é aplicada no servidor. A UI apenas esconde as ações.
8. **Segredos da organização:** ficam no servidor com envelope encryption (chave mestra via KMS ou arquivo do operador). O main do desktop busca o segredo just-in-time para abrir a sessão, sem cache persistente, e cada busca é auditada. O vault local continua valendo só para o workspace Pessoal.
9. **Sem cópia persistida** dos dados da organização no desktop: a revogação remove o acesso de fato, e não existe modo offline para a Organização.
10. **No main**, os repositórios ficam atrás de uma interface com implementações `Local` (SQLite) e `Remote` (API). O contrato IPC e o renderer não mudam de forma, só ganham o `workspaceId`.

## Alternativas

- **App cliente separado do app local:** rejeitado. Duplicaria o código e a UX; workspaces resolvem a separação.
- **Sync bidirecional local ↔ organização:** rejeitado. Gera conflitos, deixa a revogação ambígua e mistura dados pessoais com os da empresa.
- **Servidor como gateway obrigatório das sessões:** adiado. Exige muita infra e latência, e o controle de acesso já se resolve no plano de controle.
- **Senha liberada ao Visualizador no renderer:** rejeitado, exceto pela limitação já existente do `desktop-auth` no RDP/VNC (ver ADR 0009), que deve ser reavaliada.

## Consequências

- Novo repositório/produto `north-server` (API, admin web, Docker).
- Desktop: seletor de workspace, login OIDC, camada `Remote` dos repositórios e canais IPC `workspaces:*` / `auth:*`.
- Cobre o item "cloud sync opt-in" do roadmap: o mesmo backend pode virar SaaS.
- Manual + what's-new quando a primeira parte chegar ao usuário.
- Próximo passo: spike de login OIDC no Electron contra um tenant Entra de teste.

## Notas de implementação — Fase 1 (workspaces locais)

- **Rotas:** tudo vive em `/w/:workspaceId/...`. Rotas antigas (`/connections`, `/clients/:id`, `/help`…) redirecionam para o último workspace usado (`ui-store.lastWorkspaceId`) ou para `local`, mantendo query e hash. Links e `navigate` usam `useWorkspaceHref` / `useWorkspaceNavigate` / `WorkspaceLink`.
- **Cache isolado:** em vez de prefixar cada `queryKeys.*` com o `workspaceId`, cada workspace tem o próprio `QueryClient` (`WorkspaceScope`). O isolamento é o mesmo, e as chaves e invalidações existentes continuam valendo sem mudança. Trocar de workspace remonta o shell; manter abas/sessões vivas entre workspaces fica para a fase 2.
- **Main:** `WorkspaceRegistry` + `WorkspaceDataSource` (`LocalDataSource` hoje; `RemoteDataSource` na fase 2). Os handlers recebem uma visão de `Repositories` que resolve pelo workspace ativo a cada acesso. O renderer ativa o workspace por `workspaces:activate` antes de montar o shell. Organizações aparecem na lista, mas ativá-las falha até existir o North Server. Na fase 2, reavaliar passar o `workspaceId` em cada chamada em vez de um "ativo" global (necessário para multi-janela).
- **Dados:** tabela `workspaces` (migração 017) com a linha `local`. O vault continua no banco local.

## Notas de implementação — Fase 2a (servidor)

- **Mesmo repositório, pasta `server/`:** em vez de um repo separado, o servidor importa os schemas Zod de `src/shared` (Client, Connection…), então desktop e servidor não divergem. Ele continua sendo um produto à parte: tem `package.json` próprio, é empacotado com esbuild e distribuído como imagem Docker (`docker build -f server/Dockerfile .`).
- **Stack:** Fastify 5 + `pg` (SQL direto, migrações versionadas como no desktop) + `jose`. Os testes usam PGlite (Postgres em WASM, sem Docker) com `fastify.inject`.
- **Auth provisória:** o modo `dev` faz login por e-mail; produção só aceita com `NORTH_ALLOW_DEV_AUTH=1`. O access token JWT dura 5–10 min. O refresh token é opaco e guardado só como hash, com rotação e detecção de reuso (reuso revoga todas as sessões do usuário). O usuário desativado perde o acesso na próxima chamada. O Entra entra como outro modo na fase 0.
- **Inventário compartilhado:** clientes, ambientes, grupos, conexões e tags. Favoritos são por usuário. O servidor nunca guarda `credentialRef`, `privateKeyPath` nem `vpnProfileId` (apontam para coisas da máquina de cada um); os segredos chegam na fase 4. O primeiro usuário vira admin; o RBAC por projeto é a fase 3.
