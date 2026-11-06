# REC-023 — Acessos e VPN na organização

- **Status:** 🧪 Em testes
- **Ideia de origem:** IDEIA-023
- **Criado em:** 2026-11-05
- **Última atualização:** 2026-11-05
- **ADRs:** [0018](../../adr/0018-north-server-workspaces.md) (notas da Fase 8)

## Visão geral

Depois do REC-022, a organização já guardava clientes, ambientes, grupos e conexões. Para a equipe usar a organização no dia a dia, faltavam três coisas:

1. **Bancos e logins.** Os acessos (banco de dados, portal web e "outro") ficavam só no Meu workspace. O admin não conseguia liberar um banco ou uma URL para alguém.
2. **VPN que sobe sozinha.** A VPN de uma conexão apontava para o perfil do computador de quem criou. Nos outros computadores, a VPN não subia ao abrir a sessão.
3. **Levar muita coisa de uma vez.** A cópia para a organização era feita cliente por cliente, pelo botão direito. A tela de Configurações só oferecia CSV, e o texto confundia.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | A organização guarda acessos de banco, login e "outro", com senha criptografada no servidor, tags e favoritos pessoais. | Alta |
| RF-02 | O admin libera um acesso só (Editor ou Visualizador), além de cliente, ambiente, grupo e conexão. Quem recebe só um acesso vê só ele e o caminho até ele. | Alta |
| RF-03 | O Visualizador conecta no banco (estúdio SQL) com a senha salva, mas não lê nem cola a senha. Cada leitura entra na auditoria com o nome do acesso. | Alta |
| RF-04 | Coleções de API não vão para a organização por enquanto. O servidor recusa o tipo `api`. | Alta |
| RF-05 | Cliente, ambiente, conexão e acesso da organização podem indicar uma VPN. O servidor guarda só o modelo da VPN (nome, tipo, gateway, porta, realm, certificado confiado), nunca usuário, senha ou chave pré-compartilhada. | Alta |
| RF-06 | Cada computador liga o modelo a um perfil de VPN local: o já ligado, senão um perfil com o mesmo gateway, senão um perfil novo criado do modelo, sem usuário. | Alta |
| RF-07 | Abrir uma conexão ou acesso da organização sobe a VPN local certa (a do item, senão a do ambiente, senão a do cliente), como no Meu workspace. | Alta |
| RF-08 | Os perfis de VPN são do computador: aparecem iguais em todos os workspaces. | Alta |
| RF-09 | VPNs OpenVPN não são compartilhadas (o `.ovpn` costuma levar o certificado pessoal). A cópia avisa e segue sem a VPN. | Alta |
| RF-10 | Um membro vê só os modelos de VPN usados pelo que ele pode abrir. Editores publicam modelos; só admins alteram ou removem. | Média |
| RF-11 | "Copiar para workspace…" leva também acessos, tags de acesso e a VPN do cliente e do ambiente. | Alta |
| RF-12 | Em Configurações → Inventário, dentro da organização, **Copiar do Meu workspace…** copia vários clientes de uma vez. | Alta |
| RF-13 | A importação CSV dentro da organização cria também bancos e logins. | Média |
| RF-14 | O painel admin mostra os acessos na árvore e permite liberar um acesso só. | Alta |
| RF-15 | Desktops anteriores continuam funcionando com o servidor novo. | Alta |

## Requisitos técnicos

- **Servidor — migration 009:**
  - Tabela `vpns` (modelos) e colunas `vpn_id` em `clients`, `environments` e `connections`, com `ON DELETE SET NULL`.
  - Tabela `accesses`, com `credential_ref` e o mesmo gatilho das conexões para apagar a senha junto. Tabelas `access_tags` e `user_access_favorites`.
  - `project_grants` recriada com `access_id` e `scope_type = 'access'`. As liberações existentes são copiadas com o mesmo `id`.
- **Servidor — rotas:**
  - `/api/v1/accesses` (CRUD, favorito, tags) e `/api/v1/vpns`.
  - `vpnId` aceito em `POST`/`PATCH` de clientes e ambientes.
  - Um `vpnId` ou `vpnProfileId` desconhecido vira `null` em vez de erro, porque desktops antigos mandam o id do perfil local.
  - Segredos: o dono pode ser conexão ou acesso. A auditoria registra `targetType = 'access'`.
  - `/me/access` ganha `accessGrants` à parte, como `connectionGrants`.
  - Eventos `inventory.changed` com `access` e `vpn`.
- **Desktop:**
  - `InventoryStore.accesses` (SQLite ou servidor). IPC de acessos, teste de banco, busca e CSV passam a usar o workspace ativo.
  - `OrganizationVpnBridge` traduz ids na fronteira: modelo → perfil local na leitura, perfil local → modelo na escrita (publica na primeira vez ou reaproveita um modelo com o mesmo gateway). Tabela local `organization_vpn_links` (migration 023).
  - `vpnProfiles`, `vpnSecrets`, `vpnHistory` e `organizationVpnLinks` são repositórios da máquina.
  - Sessões de banco da organização leem acesso, senha e VPN do servidor e terminam quando o acesso é retirado.
  - `CopyFromPersonalDialog` em Configurações.

## Fora do escopo

- Coleções de API e workflows na organização.
- Editar modelos de VPN pelo painel admin. Hoje o modelo nasce da VPN de quem a ligou primeiro.
- Levar a chave pré-compartilhada do IPsec: cada pessoa preenche a dela.
