# Plano — VPNs no North

> Documento de handoff para implementação. Leia inteiro antes de começar, junto com `CLAUDE.md`, `docs/02-arquitetura.md`, `docs/06-seguranca.md` e as ADRs 0004, 0005 e 0007.
> Método: **TDD**. Cada tarefa abaixo lista os testes que devem ser escritos **antes** do código, e só avança quando estão verdes.

> **Status (2026-10-16):** fases 0–2 implementadas (backend, sem UI) — ver ADR 0017. Desvios registrados: `vpn:import-ovpn` **cria** o perfil já na importação (os blocos inline vão direto ao cofre, sem trafegar pelo renderer); OpenVPN no Windows fica marcado como não suportado até o Interactive Service (fase 6); erros de VPN atravessam o IPC como `[VPN:CODE] mensagem` (`shared/lib/vpn/errors.ts`); integração Docker adiada. Próximo passo: revisão antes da fase 3.

---

## Sumário
- **Parte A — BRD** (requisitos de negócio)
- **Parte B — Plano técnico**: 1. Objetivo · 2. Arquitetura · 2.11 System design · 3. UI/UX · 4. Testes · 5. Fases · 6. Segurança · 7. Docs · 8. Riscos

---

# Parte A — BRD (Business Requirements Document)

## A.1 Contexto e problema
O North centraliza o trabalho de infraestrutura (clientes, ambientes, SSH, RDP, bancos, APIs). Mas, para alcançar a maioria dos hosts dos clientes, o usuário antes precisa sair do North e:
- abrir o **FortiClient** (IPsec/SSL-VPN), que só permite **uma VPN por vez**;
- abrir o **OpenVPN Connect**, importar o arquivo e digitar usuário, senha e senha da chave;
- lembrar **qual VPN** pertence a **qual cliente/ambiente**;
- descobrir por tentativa e erro que "o SSH não conecta porque a VPN está desligada".

Essa troca de contexto acontece dezenas de vezes por dia, gera erros (VPN errada, sessão que dá timeout sem explicação) e espalha credenciais por três aplicativos.

## A.2 Objetivos de negócio
| # | Objetivo | Métrica de sucesso |
| --- | --- | --- |
| O1 | Eliminar a troca de app para acessar ambientes com VPN | ≥ 90% das conexões a ambientes com VPN iniciadas sem abrir FortiClient/OpenVPN (no mac; no Windows, excluindo IKEv1) |
| O2 | Reduzir o tempo até "estar dentro" do servidor | Do clique no SSH até o prompt, com VPN desligada: ≤ 15s no caso típico (hoje ~45–90s com troca manual) |
| O3 | Acabar com falhas "misteriosas" de conexão | 100% das falhas causadas por VPN exibidas como erro de VPN, com ação sugerida |
| O4 | Centralizar credenciais com segurança | Zero segredos de VPN fora do cofre do North (o mesmo padrão já usado em conexões) |
| O5 | Acessar vários clientes ao mesmo tempo | Duas ou mais VPNs simultâneas quando não houver conflito de rede |

## A.3 Personas
- **Consultor/SRE multi-cliente (usuário principal)**: atende de 5 a 30 clientes, cada um com sua VPN; troca de cliente várias vezes por dia; usa mac e Windows.
- **Analista de suporte**: acessa poucos ambientes e precisa que "simplesmente funcione", sem entender rotas ou túneis.

## A.4 Escopo
**Dentro:** cadastro de VPNs OpenVPN e IPsec (IKEv1 PSK+XAuth, IKEv2); vínculo com Cliente/Ambiente e override por Conexão/Acesso; conexão automática ao abrir qualquer sessão; ligar/desligar manual (vale para o sistema inteiro, inclusive o navegador); várias VPNs simultâneas com detecção de conflito; status global, logs e histórico; macOS e Windows (Linux best-effort).
**Fora (v1):** Fortinet SSL-VPN/SAML, WireGuard, sincronização de VPNs entre máquinas, políticas corporativas centralizadas.

## A.5 Requisitos funcionais
| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF01 | Importar arquivo `.ovpn` (arrastar ou escolher), detectando automaticamente quais credenciais ele exige | Must |
| RF02 | Cadastrar IPsec com os mesmos campos do FortiClient (gateway, PSK, XAuth usuário/senha) | Must |
| RF03 | Guardar todos os segredos de VPN no cofre do North | Must |
| RF04 | Vincular uma VPN a um Cliente e/ou Ambiente; o Ambiente sobrepõe o Cliente | Must |
| RF05 | Conexão/Acesso herda a VPN por padrão, podendo escolher "Nenhuma" ou outra | Must |
| RF06 | Ao abrir uma sessão (SSH, SFTP, FTP, RDP, VNC, Telnet, banco, API) de alvo com VPN, conectar a VPN automaticamente antes, mostrando o progresso | Must |
| RF07 | Ligar/desligar qualquer VPN manualmente, pela tela de VPNs e pelo indicador da titlebar | Must |
| RF08 | Manter várias VPNs ativas ao mesmo tempo | Must |
| RF09 | Detectar conflitos (redes sobrepostas, full-tunnel, limite da plataforma) e perguntar antes de conectar | Must |
| RF10 | Erros de VPN com mensagem clara e ação (corrigir senha, instalar componente, tentar de novo) | Must |
| RF11 | Reconectar automaticamente após queda ou volta da suspensão | Should |
| RF12 | Desligar automaticamente VPN aberta pelo North quando nenhuma sessão a usa (configurável) | Should |
| RF13 | Logs por VPN com redação de segredos e "copiar diagnóstico" | Should |
| RF14 | Histórico de conexões de VPN | Could |
| RF15 | Comandos de VPN na command palette | Could |
| RF16 | "Testar conexão" no cadastro | Should |

## A.6 Requisitos não funcionais
| ID | Requisito |
| --- | --- |
| RNF01 Segurança | Segredos nunca em SQLite, argv, env, logs ou resultado IPC; `.ovpn` tratado como entrada não confiável |
| RNF02 Desempenho | Overhead do North ≤ 1s sobre o tempo de handshake da VPN; a UI nunca bloqueia (tudo assíncrono) |
| RNF03 Confiabilidade | Nenhum processo `openvpn` órfão após quit/crash (limpeza no boot); nenhum arquivo temporário remanescente |
| RNF04 Usabilidade | Usuário novo cadastra o primeiro `.ovpn` e conecta em ≤ 2 minutos sem documentação; teclado e leitor de tela suportados (AA) |
| RNF05 Portabilidade | macOS 13+ e Windows 10/11; diferenças de plataforma explicitadas na UI, nunca falhas silenciosas |
| RNF06 Observabilidade | Todo erro com código (`VpnErrorCode`) e log correlacionado |
| RNF07 i18n | pt-BR, en, es |
| RNF08 Testabilidade | Lógica de domínio 100% testável sem root (drivers injetáveis, fake openvpn) |

## A.7 Histórias de usuário e critérios de aceitação
- **US1** — *Como consultor, quero importar o `.ovpn` do cliente e salvar minhas credenciais uma vez, para nunca mais digitá-las.*
  Dado um `.ovpn` com `auth-user-pass` e chave encriptada, quando eu o arrasto para a tela de VPNs, então o North mostra o resumo do servidor e pede **somente** usuário, senha e senha da chave; após salvar, "Conectar" funciona sem nenhum prompt (exceto o de admin do SO na v1).
- **US2** — *Quero clicar no SSH de um servidor do POLY e cair direto no terminal.*
  Dado o ambiente com a VPN POLY vinculada e a VPN desligada, quando eu abro o SSH, então a aba mostra "VPN POLY → Rede → SSH" e o terminal abre sem eu tocar em outra tela.
- **US3** — *Quero ligar a VPN de um cliente só para usar o navegador.*
  Quando eu ligo o switch na titlebar, então a VPN fica ativa para o sistema todo e permanece ligada até eu desligar.
- **US4** — *Quero estar em dois clientes ao mesmo tempo.*
  Dadas duas VPNs com redes distintas, as duas ficam ativas; se as redes se sobrepuserem, o North explica e me deixa escolher.
- **US5** — *Quando algo der errado, quero saber o que fazer.*
  Senha da VPN errada → mensagem "Senha recusada pelo servidor VPN" + campo para corrigir ali mesmo.
- **US6** — *No Windows, com o POLY em IKEv1, quero ao menos não precisar lembrar qual conexão abrir.* O North abre o FortiClient e espera a rede ficar disponível para continuar a sessão.

## A.8 Premissas, restrições e dependências
- O usuário tem permissão de administrador na máquina (exigência do SO para VPN).
- O cliente IPsec nativo do macOS é compatível com FortiGate IKEv1 PSK+XAuth (a validar no spike da fase 5).
- O Windows não tem cliente IKEv1 nativo → dependência do FortiClient para esse caso.
- O North é assinado com certificado self-signed → sem acesso a NetworkExtension no mac.
- OpenVPN (GPLv2) distribuído como binário separado.

## A.9 Riscos de negócio
- A experiência no Windows com IKEv1 é inferior → comunicar com transparência e incentivar IKEv2 junto aos clientes.
- O prompt de admin a cada conexão (v1) pode irritar → priorizar o helper (fase 6) se for o feedback dominante.

---

# Parte B — Plano técnico

## 1. Objetivo

Hoje o usuário alterna entre North, FortiClient e OpenVPN Connect. Queremos que o North:

1. **Cadastre VPNs** (OpenVPN e IPsec) uma vez, com segredos no cofre.
2. **Vincule uma VPN ao Cliente ou Ambiente** — as conexões/acessos herdam.
3. **Conecte a VPN automaticamente** ao abrir SSH / SFTP / FTP / RDP / VNC / Telnet / banco (SQL Studio) / API de um ambiente que exige VPN, e só então abra a sessão.
4. **Permita ligar/desligar manualmente**, como o FortiClient — a VPN vale para o sistema todo (navegador incluído).
5. **Suporte várias VPNs simultâneas**, detectando conflitos (redes sobrepostas, full-tunnel).
6. Funcione em **macOS e Windows** (Linux como bônus, é o mais fácil e é onde rodam os testes de integração).

### Casos reais do usuário (usar como fixtures de aceitação)
- **OpenVPN**: importa um `.ovpn`, informa usuário, senha e senha da chave privada.
- **FortiGate IPsec IKEv1** ("POLY"): gateway `*.fortiddns.com`, autenticação por **chave pré-compartilhada**, **XAuth** com usuário/senha salvos, sem SSO.

### Fora de escopo (v1)
- Fortinet SSL-VPN / SAML (deixar a interface de driver pronta; não implementar).
- WireGuard (idem — fácil de adicionar depois como driver).
- Helper privilegiado instalado como serviço (fase 6, opcional).

---

## 2. Decisões de arquitetura

Registrar como **ADR `docs/adr/0017-vpn.md`** (contexto, decisão, alternativas rejeitadas abaixo).

### 2.1 Por que binários externos (exceção consciente ao "tudo dentro do app")
O `CLAUDE.md` diz que sessões rodam dentro do app e não chamam clientes externos. VPN é diferente: precisa criar interface TUN, alterar rotas e DNS — exige privilégio de SO e drivers de kernel. Não há implementação viável em Node.
**Decisão:** o North **orquestra** binários/serviços maduros, e a UI continua 100% do North:

| Tipo | macOS | Windows | Linux |
| --- | --- | --- | --- |
| OpenVPN | `openvpn` empacotado em `extraResources` | OpenVPN Community (`openvpn.exe` + *Interactive Service* + driver Wintun) | `openvpn` do sistema |
| IPsec IKEv1 PSK+XAuth | Cliente nativo do macOS ("Cisco IPSec") via perfil + `scutil --nc` | **Sem cliente nativo** → driver `forticlient-launcher` (abre o FortiClient) | `vpnc` / strongSwan (bônus) |
| IPsec IKEv2 | `scutil --nc` | Nativo: `Add-VpnConnection` + `rasdial` | strongSwan (bônus) |

Alternativas rejeitadas: automatizar a UI do FortiClient (frágil, sem CLI na versão free); `openfortivpn` para o POLY (é SSL-VPN, o POLY é IPsec); NetworkExtension/`NEVPNManager` no mac (exige entitlement + Developer ID, e o North é assinado com certificado self-signed — ver `docs/10-distribuicao.md`).

Licença: OpenVPN é GPLv2 — distribuído como binário separado (agregação), incluir `LICENSE` e link do fonte em `resources/vpn/`.

### 2.2 Camadas (respeitando as fronteiras de processo)

```
renderer  features/vpns/*  ─┐  (UI, hooks TanStack Query, nunca vê segredo)
                            │ window.north.vpn.*  +  evento vpn:state-changed
preload   expõe NorthApi.vpn
shared    types/vpn.ts (Zod), ipc/channels+contract, lib/vpn/* (lógica pura testável)
main      ipc/vpn.ts
          services/vpn/
            vpn-manager.ts         ← máquina de estados + leases + eventos
            vpn-gate.ts            ← usado pelo ProtocolManager antes de abrir sessão
            privilege-broker.ts    ← como elevar (sudo prompt / interactive service / helper)
            drivers/
              vpn-driver.ts        ← interface
              openvpn-driver.ts    ← spawn + management interface
              openvpn-management.ts← parser do protocolo de management (puro)
              macos-ipsec-driver.ts← perfil + scutil --nc
              windows-ras-driver.ts← Add-VpnConnection / rasdial (IKEv2)
              forticlient-launcher-driver.ts
              fake-vpn-driver.ts   ← para testes e para o modo NORTH_VPN_FAKE=1
          repositories/vpn-profiles-repository.ts, vpn-secrets-repository.ts
```

### 2.3 Modelo de dados — migration `016-vpn.ts`

```sql
CREATE TABLE vpn_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL, -- só organização/filtro
  name TEXT NOT NULL,
  kind TEXT NOT NULL,             -- 'openvpn' | 'ipsec-ikev1' | 'ipsec-ikev2'
  config TEXT NOT NULL,           -- JSON validado por Zod (ver abaixo), SEM segredos
  auto_disconnect TEXT NOT NULL DEFAULT 'when-idle', -- 'when-idle' | 'never'
  idle_timeout_sec INTEGER NOT NULL DEFAULT 300,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE vpn_secrets (          -- mesmo padrão de connection_secrets
  vpn_profile_id TEXT NOT NULL REFERENCES vpn_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,               -- 'password' | 'key-passphrase' | 'psk' | 'private-key' | 'ovpn-inline'
  credential_ref TEXT NOT NULL,
  PRIMARY KEY (vpn_profile_id, kind)
);

ALTER TABLE clients      ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;
ALTER TABLE environments ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;
ALTER TABLE connections  ADD COLUMN vpn_mode TEXT NOT NULL DEFAULT 'inherit'; -- 'inherit' | 'none' | 'profile'
ALTER TABLE connections  ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;
ALTER TABLE accesses     ADD COLUMN vpn_mode TEXT NOT NULL DEFAULT 'inherit';
ALTER TABLE accesses     ADD COLUMN vpn_profile_id TEXT REFERENCES vpn_profiles(id) ON DELETE SET NULL;

CREATE TABLE vpn_history (id, vpn_profile_id, started_at, ended_at, trigger /* 'manual'|'auto' */, result, error_code);
```

**Migração do `vpn_required` legado:** manter a coluna (não quebrar export/import antigo). Na UI, `vpnRequired=true` sem VPN resolvida vira o aviso "Este servidor exige VPN, mas nenhuma está vinculada — Vincular agora". Apagar o campo fica para depois.

**`config` por tipo (Zod, discriminated union em `shared/types/vpn.ts`):**
- `openvpn`: `{ ovpn: string /* sem blocos inline de chave */, requiresUserPass: boolean, requiresKeyPassphrase: boolean, username?: string, remoteSummary: {host, port, proto}[], redirectGateway: boolean, declaredRoutes: string[] }`
- `ipsec-ikev1`: `{ gateway: string, groupName?: string, username: string, xauth: 'saved' | 'prompt' }`
- `ipsec-ikev2`: `{ gateway: string, remoteId?: string, username: string, auth: 'eap' | 'psk' }`

Os blocos inline `<key>`, `<tls-auth>`, `<tls-crypt>` e `<pkcs12>` do `.ovpn` são **extraídos no main na importação**, guardados no cofre (`ovpn-inline`) e reinjetados num arquivo temporário `0600` só durante a conexão, apagado no disconnect ou no boot seguinte.

### 2.4 Resolução de qual VPN usar (função pura, `shared/lib/vpn/resolve.ts`)

```
resolveVpn(target, env, client):
  target.vpnMode == 'none'    → null
  target.vpnMode == 'profile' → target.vpnProfileId
  'inherit'                   → env.vpnProfileId ?? client.vpnProfileId ?? null
```
Access resolve pelo `Group → Environment → Client` do mesmo jeito.

### 2.5 `VpnManager` — máquina de estados por perfil

```
disconnected ─connect→ connecting ─ok→ connected ─drop→ reconnecting ─ok→ connected
     ▲                    │ err            │ disconnect          │ desiste (N tentativas)
     └──── disconnecting ◄┴────────────────┘                     ▼
                                                               error
```
- Estado público: `{ profileId, status, since, localIp?, routes?, lastError?: {code, message}, leases: number, trigger }`.
- **Leases:** `acquire(profileId, holderId)` / `release(holderId)`. O `VpnGate` pega um lease por sessão aberta. Conexão manual = lease "manual", que só sai no "Desligar".
- **Auto-disconnect:** com `when-idle`, quando os leases chegam a 0 e o trigger foi `auto`, agenda o disconnect após `idle_timeout_sec`. VPN ligada manualmente nunca cai sozinha.
- **Concorrência:** duas sessões pedindo a mesma VPN ao mesmo tempo compartilham a **mesma promise** de `connecting`.
- Ciclo de vida: `powerMonitor` `suspend` → marca; `resume` → reconnect. `before-quit` → desliga todas (com timeout). Boot → limpa órfãos e arquivos temporários. **O `openvpn` roda como root**, então o North (usuário comum) não consegue dar `kill` nele: cada túnel grava `userData/vpn/<profileId>.json` com `{ pid, managementPort, managementPassword }` (0600). Desconectar = comando `signal SIGTERM` pela interface de management; no boot, para cada registro, reconecta ao management e envia `SIGTERM`; se o management não responder e o pid ainda existir, pede admin para encerrar.
- Erros tipados (`VpnErrorCode`): `AUTH_FAILED`, `KEY_PASSPHRASE_WRONG`, `TIMEOUT`, `HOST_UNREACHABLE`, `PRIVILEGE_DENIED`, `BINARY_MISSING`, `CONFLICT`, `UNSUPPORTED_ON_PLATFORM`, `DRIVER_CRASHED`. A UI mapeia código → mensagem i18n + ação sugerida.

### 2.6 `VpnDriver` (interface)

```ts
interface VpnDriver {
  readonly kind: VpnKind
  isSupported(platform: NodeJS.Platform): { ok: true } | { ok: false; reason: string }
  connect(ctx: { profile; secrets: SecretResolver; log: (line) => void; signal: AbortSignal }): Promise<VpnTunnelInfo>
  disconnect(): Promise<void>
  onDrop(cb: (err?) => void): void
}
```
O driver não conhece leases nem UI, e os segredos chegam via `SecretResolver` (lazy, no main).

**OpenVPN:** `openvpn --config <tmp> --management 127.0.0.1 <porta-aleatória> <pwfile> --management-query-passwords --management-hold --auth-nocache`. `<pwfile>` é um arquivo `0600` com uma senha de management aleatória por sessão, apagado assim que o `openvpn` abre a porta. Usuário, senha e passphrase são enviados **pela interface de management** — nunca em argv, env ou arquivo. Disconnect sempre por `signal SIGTERM` no management (o processo é root). Conectado = `>STATE:...,CONNECTED,SUCCESS`. Rotas e IP vêm de `>STATE` e de `log`.
**macOS IPsec:** instalar o perfil `.mobileconfig` (o usuário aprova uma vez em Ajustes do Sistema; a UI guia esse passo) → `scutil --nc start "<nome>" --user u --password p --secret psk` → status por `scutil --nc status`. *Spike obrigatório na fase 4.*
**Windows IKEv2:** PowerShell `Add-VpnConnection` (uma vez) + `rasdial`.
**Windows IKEv1/Forti:** `forticlient-launcher`: abre o FortiClient e fica em `connecting` até o host responder (polling TCP). A UI diz claramente "conexão gerenciada pelo FortiClient".

### 2.7 `PrivilegeBroker`
- **mac/Linux (v1):** prompt nativo de senha de admin para iniciar o `openvpn` (pacote `@vscode/sudo-prompt` ou `osascript ... with administrator privileges`). O processo elevado só roda um binário `openvpn` de caminho absoluto validado. **v1 no mac:** detectar o `openvpn` do sistema (`/opt/homebrew/sbin/openvpn`, `/usr/local/sbin/openvpn`) e, se ausente, `BINARY_MISSING` com instrução (`brew install openvpn`). Empacotar + assinar no CI fica para a fase 6 (exige build reprodutível).
- **Windows:** OpenVPN *Interactive Service* (permite usuário não-admin) — detectar se está instalado; se não, a UI oferece "Instalar componente de VPN" (MSI oficial).
- **Fase 6 (opcional):** helper `north-vpnd` (launchd/serviço Windows) com socket local autenticado → acaba o prompt a cada conexão.

### 2.8 Integração com sessões — `VpnGate`
Em `ProtocolManager.open`, `openDatabaseAccess` e `openApiAccess`, **antes** de `driver.open` (no caso de API, antes de executar a requisição HTTP no main — não há MessagePort):
```
const profileId = resolveVpn(...)
if (profileId) await vpnGate.ensure(profileId, sessionId, { onProgress })
```
- Emite `sessions:state-changed` com um novo sub-estado `vpn-connecting` (`{ vpnProfileId, vpnName, step }`) — a aba da sessão mostra o progresso.
- Depois de `connected`, faz uma **sondagem TCP** no host/porta alvo (timeout de 8s, 3 tentativas) antes de abrir a sessão, porque rotas podem demorar.
- Ao fechar a sessão → `release`.
- Falha da VPN → a sessão vai para `error` com `cause: 'vpn'` e o código da VPN (não um "timeout SSH" genérico).
- O health monitor (`connection-monitor-service`) **não** deve subir VPN sozinho; quando a VPN resolvida do alvo não está `connected`, pula a sondagem e marca o host como "requer VPN (desligada)" (em vez de "offline").

### 2.9 Conflitos (puro, `shared/lib/vpn/conflicts.ts`)
`detectConflicts(candidate, active[]) → Conflict[]` com tipos `overlapping-routes` (CIDRs sobrepostos — usar parsing IPv4/IPv6 próprio e testado), `full-tunnel` (um dos dois tem `redirect-gateway`) e `platform-single-ipsec` (mac: só um IKEv1 por vez). Antes de conectar, se houver conflito, a UI pergunta: **Desligar X e conectar** / **Conectar mesmo assim** / **Cancelar**. Na conexão automática vinda de sessão, aplica a mesma pergunta (bloqueante, dentro da aba).

### 2.10 IPC (seguir a ordem do `CLAUDE.md`)
`vpn:list`, `vpn:get`, `vpn:create`, `vpn:update`, `vpn:delete`, `vpn:import-ovpn` (recebe o conteúdo do arquivo e devolve o perfil-rascunho com os requisitos detectados), `vpn:set-secret`, `vpn:connect`, `vpn:disconnect`, `vpn:status` (todas), `vpn:logs` (ring buffer, 2000 linhas, **com redação de segredos**), `vpn:check-conflicts`, `vpn:platform-support` e o evento `vpn:state-changed`. Nenhum resultado carrega segredo. Atualizar `api-surface.test.ts`.

---

## 3. UI/UX

Princípio: **o usuário pensa em "cliente", não em "túnel"**. Tudo que for técnico (rotas, logs) fica a um clique, nunca na frente.

### 3.1 Superfícies
1. **Indicador global na titlebar** — pílula discreta: cinza "VPN" quando nenhuma está ativa; verde "● POLY" com uma ativa; "● 2 VPNs" com várias; âmbar pulsando quando conectando; vermelho quando caiu. Clique abre um **popover** com a lista de VPNs (as do cliente atual primeiro), cada uma com um switch, status, IP e uptime, mais o link "Gerenciar VPNs". É o substituto direto do ícone do FortiClient.
2. **Rota `/vpns`** (item na sidebar, ícone Lucide `ShieldCheck`) no layout de três painéis já existente: lista agrupada por cliente → painel de detalhes com abas **Visão geral** (status, botão grande Conectar/Desligar, IP, rotas, ambientes vinculados), **Configuração**, **Logs** (xterm somente-leitura, com busca e "Copiar diagnóstico" já redigido) e **Histórico**.
3. **Formulários de Cliente e Ambiente** — campo "VPN" (combobox): `Nenhuma` / perfis (os do cliente primeiro) / `+ Nova VPN…` (abre o wizard e volta já selecionada).
4. **Formulário de Conexão/Acesso** — substituir o checkbox "VPN obrigatória" por um select: `Herdar do ambiente (POLY)` (mostra o nome resolvido) / `Nenhuma` / `Outra…`.
5. **Linha da conexão na lista e no painel de detalhes** — mini-badge de escudo com o estado da VPN resolvida (verde = já está ligada, cinza = vai conectar ao abrir).
6. **Command palette** — "Conectar VPN POLY", "Desligar todas as VPNs".

### 3.2 Wizard "Nova VPN"
- Passo 1: escolher o tipo com cards grandes: **Arquivo OpenVPN (.ovpn)** · **FortiGate / IPsec** · **IKEv2**. Aceitar *drag-and-drop* de `.ovpn` direto na tela de VPNs, pulando este passo.
- Passo 2 (OpenVPN): após o parse, mostrar um resumo legível ("Servidor vpn.cliente.com:1194 UDP · exige usuário e senha · chave privada protegida por senha") e pedir **apenas** os campos que o arquivo exige.
- Passo 2 (IPsec): campos com os **mesmos nomes e a mesma ordem do FortiClient** (Gateway remoto, Método de autenticação = Chave pré-compartilhada, Chave, XAuth: Salvar login/Perguntar, Usuário, Senha), para o usuário copiar olhando a tela antiga. No Windows com IKEv1, aviso honesto: "No Windows, essa VPN será aberta pelo FortiClient" + link "por quê?".
- Passo 3: nome, cliente, ambientes a vincular (multi-select pré-marcado com os ambientes do cliente que têm conexões `vpnRequired`).
- Passo 4: **Testar conexão** (conecta, mostra o resultado e desconecta) — opcional, mas em destaque.

### 3.3 Fluxo automático na aba da sessão
Ao abrir um SSH de um ambiente com VPN, a aba mostra um **stepper** em vez do terminal vazio:
```
 ✓ VPN POLY        conectada (10.212.134.5)
 ◌ Rede            verificando 10.0.3.15:22…
 ○ SSH             aguardando
```
Erros com ação: "Senha da VPN recusada — **Atualizar senha**" (abre o campo inline, sem sair da aba) · "Componente de VPN não instalado — **Instalar**" · "Permissão de administrador negada — **Tentar de novo**". Em nenhum caso mostrar stack trace; o log fica em "Ver detalhes".

### 3.4 Detalhes de qualidade
- Toasts só para eventos inesperados (queda, reconexão); ações iniciadas pelo usuário dão feedback inline.
- Queda da VPN com sessões abertas: banner na aba "VPN caiu — reconectando (2/5)…"; o terminal não fecha imediatamente.
- Estados vazios com CTA ("Nenhuma VPN ainda. Arraste um .ovpn aqui ou **Nova VPN**").
- Acessibilidade: o switch tem `aria-label="Conectar VPN POLY"`, o estado é anunciado por `aria-live="polite"` e a cor nunca é o único sinal (sempre ícone + texto).
- Tokens do design system, sem cores literais; dark e light.
- i18n pt-BR / en / es completo.
- Antes de começar a UI, usar a skill `frontend-design` para fechar a direção visual dentro do design system existente.

---

## 4. Estratégia de testes

| Nível | Ferramenta | O que cobre |
| --- | --- | --- |
| Unit | Vitest | resolver, conflitos/CIDR, parser `.ovpn`, parser de management, redação de logs, máquina de estados (fake driver + fake timers), leases/auto-disconnect, mapeamento de erros, migrations, repositórios, `VpnGate` + `ProtocolManager` com VpnManager fake, superfície IPC |
| Contrato de driver | Vitest + **fake openvpn** | `test/fixtures/fake-openvpn.mjs`: script Node que imita o binário (abre a porta de management, pede senha, emite `STATE`, simula `AUTH_FAILED`, queda, lentidão) conforme `FAKE_OPENVPN_SCENARIO`. Testa o `openvpn-driver` real, cross-platform, sem root |
| Integração real | Vitest, suíte separada `npm run test:vpn:integration` | Docker no CI Linux: container com servidor OpenVPN + container cliente (`--cap-add NET_ADMIN --device /dev/net/tun`) rodando o driver de verdade; casos: conectar, senha errada, passphrase da chave, queda do servidor → reconexão, duas VPNs simultâneas com sub-redes distintas. Não roda no `npm run test` padrão |
| UI E2E | **Cypress** (padrão do repo) | `e2e-harness/VpnHarnessApp.tsx` + `mock-north.ts` com `vpn.*` roteirizável (`cy.window().then(w => w.__vpnMock.emit(...))`). Fluxos da seção 5 |
| App real (smoke) | **Playwright `_electron`** (novo, poucos testes) | Sobe o app empacotado com `NORTH_VPN_FAKE=1` (registra o `fake-vpn-driver`): titlebar → conectar → abrir uma conexão vinculada → stepper → sessão. Garante que IPC, preload e eventos funcionam ponta a ponta, coisa que o harness mockado não cobre |
| Manual | `docs/09-qa.md` + `11-validacao-pratica.md` | Checklist com o OpenVPN real do usuário e o POLY no mac/Windows, suspensão e retorno, Wi-Fi caindo, quit com VPN ativa |

Regras TDD: cada tarefa começa por um teste vermelho; nenhum teste é enfraquecido para passar; os cenários do fake openvpn são gravados a partir de transcripts reais (`--management` + `log on all`) e versionados em `test/fixtures/openvpn-transcripts/`.

---

## 5. Fases

Cada fase termina com `npm run lint && npm run typecheck && npm run test && npm run test:e2e` verde, além do manual e do what's-new quando houver mudança visível.

### Fase 0 — Fundação (≈1 dia)
- ADR 0017. Esqueleto de pastas. Fixtures: `.ovpn` de exemplo (inline e por arquivo, com e sem `auth-user-pass`, com chave encriptada) e transcripts de management.
- Fake openvpn + `fake-vpn-driver`.

### Fase 1 — Dados e lógica pura (≈1–1,5 dia)
**Testes primeiro:**
- `migrations.test.ts`: 016 cria as tabelas/colunas; FKs `SET NULL`; dados existentes intactos.
- `vpn-profiles-repository.test.ts`: CRUD; deletar perfil anula os vínculos em env/client/connection; deletar o perfil apaga os `vpn_secrets` **e** os blobs do cofre.
- `resolve.test.ts`: tabela de casos (inherit→env, inherit→client, env sobrepõe client, none, profile explícito, access via group).
- `ovpn-parse.test.ts`: detecta `auth-user-pass`, chave encriptada, `remote` múltiplos, `redirect-gateway`, rotas; extrai blocos inline; rejeita diretivas perigosas (`up`, `down`, `script-security` > 1, `plugin`) com erro explicativo.
- `conflicts.test.ts`: sobreposição de CIDR (bordas, /32, IPv6), full-tunnel, single-ipsec no mac.
- `redact.test.ts`: senha, PSK e conteúdo de chave nunca aparecem no log.

### Fase 2 — OpenVPN ponta a ponta no main (≈2 dias)
**Testes primeiro:**
- `openvpn-management.test.ts` (parser) com os transcripts.
- `openvpn-driver.test.ts` contra o fake: conecta; envia credenciais pelo management (assert: não estão em argv/env); `AUTH_FAILED` → código certo; passphrase errada; timeout; processo morre → `onDrop`; o arquivo temporário é apagado em todos os caminhos.
- `vpn-manager.test.ts`: transições; promise compartilhada em connects concorrentes; leases; auto-disconnect com fake timers; manual nunca cai sozinha; reconnect com backoff; suspend/resume; limpeza de órfãos.
- `privilege-broker.test.ts`: monta o comando certo por plataforma; caminho do binário validado; cancelamento → `PRIVILEGE_DENIED`.
- IPC: canais, contract, preload e handlers; `api-surface.test.ts` atualizado; nenhum resultado com segredo (teste explícito).
- Integração Docker (CI Linux) — **adiada**: exige job Linux novo no CI; entra junto da fase 6.

> **Checkpoint:** ao fim da fase 2, parar para revisão antes de iniciar a UI.

### Fase 3 — UI da seção VPNs + titlebar (≈2 dias)
**Cypress primeiro** (`cypress/e2e/vpn/`):
- `empty-state.cy.ts`, `import-ovpn.cy.ts` (drop → resumo → só pede os campos exigidos → salvo), `ipsec-form.cy.ts` (campos espelhando o FortiClient; aviso no Windows via mock de plataforma), `toggle-connect.cy.ts` (switch → conectando → conectada com IP; erro de auth → ação "Atualizar senha"), `titlebar-indicator.cy.ts` (0, 1, 2 VPNs; popover; queda → vermelho), `multiple-vpns.cy.ts`, `conflict-dialog.cy.ts`, `logs-tab.cy.ts` (sem segredos, copiar diagnóstico), `a11y.cy.ts` (labels, foco, `aria-live`).
- Manual: novo capítulo "VPNs" (3 locales). What's-new.

### Fase 4 — Vínculo + conexão automática (≈2 dias)
**Testes primeiro:**
- `vpn-gate.test.ts` e `protocol-manager.test.ts`: sessão de env com VPN chama `ensure` antes do driver; sem VPN não chama; erro da VPN vira erro da sessão com `cause: 'vpn'`; fechar a sessão faz `release`; duas sessões, uma VPN; sondagem TCP com retry; `vpnMode: 'none'` ignora a herança.
- Cypress: `environment-link.cy.ts` (combobox + "Nova VPN…" inline), `connection-inherit.cy.ts` (mostra "Herdar (POLY)"), `auto-connect-ssh.cy.ts` (stepper completo), `auto-connect-error.cy.ts` (corrigir senha inline e repetir), `auto-disconnect.cy.ts`, `legacy-vpn-required.cy.ts` (aviso "Vincular agora").
- Configurar Playwright-electron (`npm run test:app`, movido da fase 0) + smoke ponta a ponta com o driver fake.
- `openApiAccess` coberto pelo gate (requisição HTTP só após a VPN).
- `connection-monitor-service.test.ts`: alvo com VPN desligada → status "requer VPN", sem sondagem.

### Fase 5 — IPsec (≈2–3 dias)
- **Spike (timebox de 0,5 dia)** no mac: gerar um `.mobileconfig` IKEv1 PSK+XAuth compatível com FortiGate, instalar, `scutil --nc start ... --user --password --secret`, ler o status. Registrar o resultado na ADR. Se falhar, o fallback é o `forticlient-launcher` também no mac.
- `macos-ipsec-driver.test.ts` (comandos e parsing de `scutil --nc status` com fixtures; o `exec` é injetado), `windows-ras-driver.test.ts` (idem PowerShell/rasdial), `forticlient-launcher-driver.test.ts`.
- UI: guia de aprovação do perfil no mac (passo a passo com screenshot); estado "gerenciada pelo FortiClient".
- Validação manual com o POLY.

### Fase 6 — Polimento e opcional (≈2–4 dias)
- Windows: detecção e instalação guiada do OpenVPN Interactive Service + Wintun; empacotamento (`electron-builder.yml` `extraResources` por plataforma) e CI.
- Histórico de VPN, palette, atalhos.
- (Opcional) helper `north-vpnd` para acabar o prompt de admin — ADR própria.

---

## 6. Segurança (checklist de revisão)
- [ ] Nenhum segredo de VPN no SQLite, em argv, em env, em log ou em resultado IPC.
- [ ] Arquivo temporário do `.ovpn` com permissão `0600` em `userData/vpn/tmp`, apagado em todos os caminhos e no boot.
- [ ] `.ovpn` importado é dado não confiável: bloquear `up`/`down`/`route-up`/`plugin`/`script-security >1`/`management` externo.
- [ ] O processo elevado executa somente o binário empacotado (caminho absoluto + checagem de hash opcional).
- [ ] A porta de management fica só em `127.0.0.1`, é aleatória e exige senha de management gerada por sessão (arquivo `0600` apagado logo após o bind).
- [ ] Registro de túnel (`userData/vpn/<id>.json`) com `0600`; removido no disconnect.
- [ ] Export/backup do North inclui os perfis **sem** segredos (como já é feito com conexões).
- [ ] Deletar cliente/perfil limpa os blobs do cofre.
- [ ] Atualizar `docs/06-seguranca.md`.

## 7. Docs a atualizar
`docs/02-arquitetura.md` (VpnManager/Gate), `04-modelo-dados.md` (migration 016), `06-seguranca.md`, `07-roadmap.md`, `08-protocolos.md` (seção VPN), `09-qa.md` + `11-validacao-pratica.md` (checklist manual), `10-distribuicao.md` (binários empacotados), `CLAUDE.md` (resumo do `VpnGate` e a exceção dos binários externos), manual in-app (capítulo VPNs, 3 locales), what's-new.

## 8. Riscos e perguntas em aberto
| Risco | Mitigação |
| --- | --- |
| IKEv1 via perfil no mac não funcionar com o FortiGate | Spike timeboxed na fase 5; fallback `forticlient-launcher` |
| Windows sem cliente IKEv1 | `forticlient-launcher`; sugerir IKEv2 ao admin do cliente |
| Prompt de admin a cada conexão incomoda | Fase 6 (helper); no Windows o Interactive Service já resolve |
| Redes sobrepostas entre clientes | Detector de conflitos + diálogo |
| DNS split (nomes internos do cliente) | v1: usar o DNS empurrado pelo OpenVPN; documentar a limitação no mac (`scutil` / resolver por domínio) como melhoria |
| `openvpn` roda como root e não pode ser morto pelo North | Disconnect/limpeza pelo management (`signal SIGTERM`); fallback com prompt de admin |
| App self-signed no mac | Já documentado; o binário `openvpn` empacotado precisa ser assinado no mesmo passo do CI |
