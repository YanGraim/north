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

## Notas de implementação — Fase 3a (papéis por projeto)

- **Concessões:** `project_grants` (migração 003) liga um usuário a um cliente, ambiente ou grupo com papel `editor` ou `viewer`. São três FKs (uma por nível) com `ON DELETE CASCADE`, então excluir o projeto ou o usuário apaga a concessão. Admin continua global em `users.role`.
- **Regra:** a concessão vale para o nó e tudo abaixo dele; a mais forte no caminho vence. Os pais de um nó concedido aparecem (só leitura) para a árvore chegar até ele. Membro sem concessão vê a organização vazia. Item invisível responde 404, não 403, para não vazar ids; item visível mas só de leitura responde 403.
- **Quem faz o quê:** criar cliente é só admin. Editor cria, edita e exclui dentro do projeto (inclusive o próprio nó concedido) e não move conexão para projeto que não edita. Tags: qualquer editor cria; renomear e excluir é admin. Favoritos são pessoais, então o visualizador também favorita.
- **Segredos:** seguem o acesso da conexão dona. Um segredo solto (gravado e ainda não ligado) só o autor vê, e uma conexão só aceita o próprio segredo ou um solto do mesmo autor; antes, qualquer membro podia apontar uma conexão para o segredo de outra e revelá-lo. Revelar com `purpose: session` exige leitura; `reveal` e `paste` exigem edição, então o visualizador conecta sem nunca ver a senha.
- **API admin:** `GET/POST /api/v1/admin/users`, `PATCH /admin/users/:id` (papel, desativar, nome; nunca tira o último admin ativo, e desativar revoga os refresh tokens), `GET/PUT/DELETE /admin/grants` (o `GET` com `scopeType`/`scopeId` mostra quem alcança aquele projeto, inclusive por concessões acima). Toda mudança entra na auditoria (`user.create | user.update | grant.set | grant.delete`).
- **Desktop:** `GET /api/v1/me/access` → `workspaces:access` → `usePermissions()`. O cálculo fica em `src/shared/types/workspace-access.ts` (o Pessoal é sempre `admin`). Os botões e menus de criar, editar, duplicar e excluir, e "Colar senha" no terminal, somem quando não se aplicam. Numa organização, as ações ficam escondidas até o papel chegar; o servidor continua checando cada chamada.
- **Limitação que segue:** no RDP/VNC a senha ainda chega ao renderer no `desktop-auth` (ADR 0009), inclusive para o visualizador. Resolver exige fazer o handshake no main; por enquanto fica documentado.

## Notas de implementação — Fase 3b (painel admin web)

- **Onde:** `server/admin/` (HTML, CSS e um módulo JS sem build nem framework), servido pelo próprio North Server em `/admin` e copiado para a imagem Docker. Só `index.html`, `admin.js` e `admin.css` são servidos (lista fixa, nada mais da pasta), com CSP `default-src 'self'` sem `unsafe-inline`, `frame-ancestors 'none'`, `nosniff` e `no-referrer`. A página monta o DOM com `createElement`/`textContent`, nunca `innerHTML` com dados.
- **Sessão:** usa a mesma API do desktop (`/api/v1`). O access token fica em memória; o refresh token fica em `sessionStorage` (sobrevive a um reload da aba e some ao fechá-la). Só admin entra; membro vê "Só admins usam este painel". O login é o de teste por e-mail até a fase 0 (Entra).
- **Telas:** **Pessoas** (adicionar antes do primeiro login, trocar papel, desativar/reativar), **Projetos** (árvore cliente → ambiente → grupo; para cada nó, quem tem acesso, inclusive herdado de cima, dar acesso como editor/visualizador e remover o direto) e **Auditoria** (as últimas 500, com filtro). Textos em pt-BR, en e es (pelo idioma do navegador ou `?lang=`).
- **Desktop:** para admins, o seletor de workspace ganha **Abrir painel admin**, que abre `<servidor>/admin` no navegador do sistema.
- **Testes:** `playwright/admin-panel.spec.ts` roda contra um North Server real com Postgres em memória (`server/src/dev-pglite.ts`, segundo `webServer` do Playwright).

## Notas de implementação — Fase 5 (tempo real e revogação)

- **Canal:** WebSocket `GET /api/v1/events` (`@fastify/websocket`). O token vai na primeira mensagem (`{ type: 'auth', token }`), não na URL, para não cair em logs; sem token válido em 5 s fecha com 4401. As mensagens dizem só *o que* mudou, nunca os dados: cada desktop busca de novo pela API, que já filtra pelo acesso.
- **Eventos:** `inventory.changed { entity }` para todos, a cada escrita bem-sucedida em clientes, ambientes, grupos, conexões ou tags (favoritos são pessoais e não vão); `access.changed` só para a pessoa afetada (concessão dada/removida, papel trocado); `session.revoked` quando ela é desativada, seguido de fechar com 4403.
- **Uma instância:** o hub fica em memória. Vários servidores atrás de um balanceador precisariam repassar pelo Postgres (`LISTEN/NOTIFY`).
- **Desktop (main):** `OrganizationEvents` por organização, ligado na primeira ativação e desligado ao sair; reconecta com backoff (1 s → 30 s), renova o token num 4401 e para num 4403. Num `access` ou `inventory`, o `ProtocolManager.revalidate(workspace)` pergunta de novo cada sessão aberta daquela organização e encerra as que o usuário não alcança mais ("Seu acesso a esta conexão foi removido."). Num revogado, encerra todas as sessões da organização, descarta o refresh token e volta o ativo para o Pessoal.
- **Renderer:** `workspaces:event` → invalida o cache daquele workspace (árvore, permissões); num `signed-out`, aviso e volta para o Meu workspace.

## Notas de implementação — Fase 0 (login Entra ID)

- **Fluxo:** authorization code + PKCE (S256), cliente público, sem client secret. O desktop abre o navegador do sistema (`shell.openExternal`) e recebe o retorno num listener de loopback de uso único em `http://localhost:<porta>` (RFC 8252; o Entra ignora a porta em loopback, então o app registration só precisa de `http://localhost` em "Mobile and desktop applications"). O main troca o código pelo `id_token` e o entrega ao servidor em `POST /api/v1/auth/oidc/login` com o `nonce`. Nada disso passa pelo renderer.
- **Servidor:** confere assinatura (JWKS da discovery do issuer), `iss`, `aud` = client id, `tid` = tenant, `nonce` e validade. Não guarda token da Microsoft; abre a sessão própria (mesmo access/refresh da fase 2a). `GET /api/v1/info` publica `auth.oidc` (client id, scopes, endpoints) para desktop e painel.
- **Identidade:** a pessoa é ligada pelo `oid` do Entra (coluna `users.external_id`, migração 004), não pelo e-mail. No primeiro login liga por e-mail a quem o admin já adicionou (ou a uma conta do modo dev). Um e-mail já ligado a outro `oid` é recusado (409), para uma caixa reaproveitada não herdar acessos.
- **Quem entra:** `NORTH_OIDC_ALLOW_NEW_USERS=1` (padrão) deixa qualquer pessoa do tenant entrar como membro sem projetos; `0` aceita só quem o admin adicionou (o primeiro usuário da instância sempre entra, como admin).
- **Grupos → admin:** `NORTH_OIDC_ADMIN_GROUPS` (object ids). Com isso, o papel admin/membro segue o grupo a cada login, nunca rebaixando o último admin. Sem o claim `groups` no token (não configurado ou acima do limite do Entra), o papel atual fica. Editor/visualizador por projeto continuam no painel.
- **Painel admin:** o mesmo fluxo no navegador (plataforma "Single-page application", redirect `https://<servidor>/admin/`); a CSP libera `connect-src` só para a origem do issuer. O `?code=` some da barra na hora.
- **Testes:** provedor OIDC falso no formato do Entra (`server/src/dev/fake-oidc.ts`, nunca empacotado) — usado nos testes do servidor, do main (registry + loopback) e no Playwright (`NORTH_FAKE_ENTRA=<porta>` no `dev-pglite`).

## Notas de implementação — Fase 6 (copiar para workspace e CSV)

- **Copiar para workspace…:** ação no menu de contexto de cliente, ambiente, grupo e conexão; aparece só quando existe outro workspace. O main (`workspaces/workspace-copy.ts`) lê a origem pelo `InventoryStore`/`SecretStore` do workspace ativo e escreve no de destino (`workspaces:copy-targets`, `workspaces:copy`). Para uma organização de destino que não está ativa, confere a sessão com `/me` antes de copiar.
- **Cópia nova e sem vínculo:** ids novos, favorito zerado, nome com "(cópia)" quando já existe um igual no destino. Tags casam por nome (criadas se faltarem). Jump host só acompanha se veio na mesma cópia; senão vira aviso.
- **Senhas:** só com "Copiar senhas". O destino recriptografa (vault local ou envelope do servidor). Ler da organização é um `reveal` auditado; quem só pode conectar (visualizador) copia sem senha, com aviso por conexão. Visualizador pode copiar para fora (é só leitura); escrever na organização segue o RBAC do servidor.
- **Fora por enquanto:** acessos (banco/login), workflows, variáveis de grupo e os segredos extras da conexão (passphrase/sudo), porque a organização ainda não os guarda. O relatório conta o que ficou de fora.
- **CSV na organização:** `importInventoryCsv` agora é assíncrono sobre `InventoryStore` + `SecretStore`, então importa no workspace ativo. Na organização entram só linhas `servidor`; `banco`/`login` viram erro por linha. Senha de uma linha pulada (duplicada) é apagada. Backup em JSON continua só no Meu workspace (os botões somem na organização).

## Ideia registrada — Fase 8 (acesso sem credencial: certificados SSH do North)

Pedido da equipe (2026-10-23): a empresa dá acesso a um servidor e a pessoa conecta sem nunca conhecer usuário/senha. Hoje o Visualizador já conecta sem revelar a senha, mas o segredo ainda chega ao processo main do desktop para o handshake. Proposta: o North Server vira uma CA SSH; cada servidor de destino confia nela (`TrustedUserCAKeys` no `sshd_config`, aplicável por workflow), e ao conectar o servidor emite um certificado de poucos minutos para o principal do usuário (ex. `arthur`) naquele host, após checar o acesso no projeto. Sem senha para vazar; revogar no painel corta o próximo certificado; cada emissão vai para o audit. Opcional: provisionar o usuário no destino na primeira vez usando a conta sudo guardada só no servidor. Referências do modelo: Teleport, HashiCorp Boundary. Depois do deploy (Fase 7).
