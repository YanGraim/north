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

## Notas de implementação — Fase 2b (desktop ↔ servidor)

- **`InventoryStore` assíncrono** para a árvore (clientes, ambientes, grupos, conexões, tags), com uma versão Local (SQLite) e uma Remote (HTTP). Os handlers dessas áreas, a busca e o dashboard usam `await`. O main testa o Remote contra o servidor real (PGlite) no mesmo repositório.
- **O resto numa organização:** os outros repositórios respondem às listas com `[]`, e as ações dão um erro explicando que ainda não estão disponíveis. Abrir sessões a partir de uma organização depende dos segredos (fase 4).
- **Sessão:** `OrganizationClient` no main. O access token fica só em memória; o refresh token fica no vault (`safeStorage`), referenciado por `workspaces.refresh_credential_ref` (migração 018). Num 401, o app renova uma vez e tenta de novo; se falhar, encerra a sessão local. Fora de loopback, só `https`.
- **IPC:** `workspaces:probe | add-organization | remove`. Nenhum token chega ao renderer.
- **UI:** o **+** abre "Adicionar organização" (endereço → nome da organização → e-mail). A organização ativa mostra o e-mail de quem entrou e a opção "Sair desta organização". A lista de workspaces fica no cache raiz do TanStack Query.

## Notas de implementação — Fase 4 (segredos e conectar)

- **Envelope encryption no servidor:** cada segredo tem a própria chave de dados (AES-256-GCM), embrulhada pela chave mestra do operador (`NORTH_MASTER_KEY` em base64, ou `NORTH_MASTER_KEY_FILE` para secret do Docker/K8s). O id do segredo é o AAD das duas camadas, então uma linha copiada para outro id não abre. Em produção o servidor não sobe sem a chave; fora dela, as rotas de segredo respondem 503 `secrets_unavailable`. KMS fica para depois; a interface (`seal`/`open`) já isola esse ponto.
- **Mesmo contrato do desktop:** `connections.credentialRef` passa a ser o id de um segredo do servidor (`secrets`, migração 002). `POST/PUT/GET/DELETE /api/v1/secrets` espelham `vault:set|has|delete`; o texto só sai por `POST /secrets/:id/reveal { purpose: session | reveal | paste }`, e só para um segredo que alguma conexão usa. Um trigger apaga o segredo junto com a conexão (inclusive em cascata) ou quando ela troca de segredo. Duplicar re-sela o segredo com um id novo.
- **Auditoria:** `audit_events` registra `secret.create | write | delete | read` com quem, alvo e propósito, nunca o valor. `GET /api/v1/audit` é só para admin (403 `forbidden` para os demais). O painel de auditoria vem com o admin web (fase 3).
- **Desktop:** `SecretStore` por workspace (`local` = vault/`safeStorage`; `remote` = servidor). Os canais `vault:*` seguem o workspace ativo, então o formulário de conexão e "Colar senha" funcionam sem mudar o renderer. O `ProtocolManager` ganhou um `ConnectionSource`, consultado a cada `open()`: numa organização, a conexão vem do servidor e a senha é buscada just-in-time (`purpose: session`), sem cache. Known hosts continuam por máquina em qualquer workspace. VPN e chave privada continuam locais e não se aplicam a conexões da organização por enquanto.
- **Fora do escopo:** papel Visualizador e o `desktop-auth` de RDP/VNC (a senha ainda chega ao renderer nesses protocolos) ficam para a fase 3, junto com o RBAC. Accesses, workflows e APIs numa organização também ficam para depois.
