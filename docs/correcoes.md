# Correções (bugs)

- **Última atualização:** 2026-11-04

Registro de defeitos, regressões e comportamentos inesperados em funcionalidades existentes, da abertura à correção. Procedimento: skill `ciclo-vida-recursos` (Fase 5). Commits de correção usam `fix(scope): ...` com o trailer `Refs: BUG-XXX`.

## Legendas

| Status | Significado |
| --- | --- |
| 🐛 Aberto | Reportado, aguardando diagnóstico |
| 🔄 Em correção | Causa raiz identificada, correção em andamento |
| ✅ Corrigido | Corrigido, validado e com teste de regressão quando viável |
| ❌ Inválido | Comportamento esperado ou não reproduzível |

| Severidade | Critério |
| --- | --- |
| Crítica | Perda de dados, vazamento de segredo ou app inutilizável |
| Alta | Fluxo principal quebrado (conectar, salvar, autenticar) |
| Média | Cenário específico, com contorno |
| Baixa | Cosmético |

## Tabela geral

| ID | Defeito | Área / Recurso | Severidade | Plataforma | Status | Reportado em | Corrigido em |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | IPsec no Windows avisa strongSwan/build.sh quando falta a distro WSL | VPN | Alta | Windows | ✅ Corrigido | 2026-10-30 | 2026-10-30 |
| BUG-002 | Instalar o serviço de VPN no Windows exige a pasta openconnect | VPN | Alta | Windows | ✅ Corrigido | 2026-10-30 | 2026-10-30 |
| BUG-003 | IPsec no Windows fica conectado sem alcançar as redes da VPN | VPN | Alta | Windows | ✅ Corrigido | 2026-10-31 | 2026-10-31 |
| BUG-004 | Abrir o painel de log deixa a janela preta | REC-004 / REC-008 | Alta | Windows | ✅ Corrigido | 2026-10-31 | 2026-10-31 |
| BUG-005 | Gancho OSC 7 aparece cortado no terminal ao conectar | REC-010 | Baixa | todas | ✅ Corrigido | 2026-11-04 | 2026-11-04 |

## Detalhamento

### BUG-001 — IPsec no Windows avisa o script errado quando falta a distro

- **Área / Recurso:** VPN
- **Severidade:** Alta
- **Plataforma:** Windows
- **Status:** ✅ Corrigido
- **Reportado em:** 2026-10-30

**Passos para reproduzir:**

1. Abrir o North em desenvolvimento no Windows, sem `resources/vpn/bin/` (a pasta é gitignored).
2. Cadastrar uma VPN IPsec IKEv1 (ex.: Poly) e conectar.

**Esperado:** aviso de que falta a distro WSL do North (`north-wsl.tar.gz`) e como gerá-la em desenvolvimento (`build-wsl.sh`).
**Atual:** `BINARY_MISSING` dizendo que o strongSwan não veio e apontando `scripts/vpn-binaries/build.sh`, que gera o `charon-cmd` de macOS/Linux e não a distro do Windows.

**Causa raiz:** no Windows o `StrongswanDriver` trata `binary()` como “motor presente”. Em `src/main/ipc/vpn.ts` essa função é o tarball `resources/vpn/bin/north-wsl.tar.gz` (WSL), não o `charon-cmd`. Com o arquivo ausente, `binary()` devolve null e o driver lança a mensagem fixa de macOS/Linux, antes de `WslIpsec.ensure()`.

**Solução:** mensagem própria (`WSL_DISTRO_MISSING`) quando o tarball não está no pacote, usada no driver e no `WslIpsec`. macOS/Linux continuam com o aviso do `build.sh`.
**Arquivos:** `src/main/services/vpn/wsl-ipsec.ts`, `src/main/services/vpn/drivers/strongswan-driver.ts`, `src/main/ipc/vpn.ts`
**Corrigido em:** 2026-10-30

### BUG-002 — Instalar o serviço de VPN exige o OpenConnect

- **Área / Recurso:** VPN
- **Severidade:** Alta
- **Plataforma:** Windows
- **Status:** ✅ Corrigido
- **Reportado em:** 2026-10-30

**Passos para reproduzir:**

1. Ter `north-vpn-service.exe` e `north-wsl.tar.gz` em `resources/vpn/bin`, sem a pasta `openconnect`.
2. Conectar uma VPN IPsec IKEv1 (Poly).

**Esperado:** o serviço instala e segura as rotas do IPsec. O OpenConnect só é necessário para SSL-VPN.
**Atual:** primeiro `copy engines: CreateFile ...\openconnect`. Depois de pular essa pasta, `open C:\Program Files\North VPN Service\north-vpn-service.exe: The system cannot find the path specified.`

**Causa raiz:** `install` sempre copiava `openconnect/` de ao lado do exe. Essa pasta é o motor da SSL-VPN, montada no CI por `build-windows.sh`. O IPsec no Windows usa o serviço só para rotas (`cmd: routes`) e a distro WSL para o túnel. Ao pular a cópia, `RemoveAll` apagava `Program Files\North VPN Service` e nada recriava o diretório antes de gravar o exe.

**Solução:** `copyBundledEngines` ignora a pasta quando ela não veio no pacote. `prepareInstallDir` cria o diretório e, se o exe antigo estiver em uso, renomeia para `.old` em vez de apagar. O North também deixa de achar que o serviço está parado só porque `existsSync` não vê o named pipe.
**Arquivos:** `resources/vpn/windows-service/main_windows.go`, `resources/vpn/windows-service/engines.go`
**Corrigido em:** 2026-10-30

### BUG-003 — IPsec no Windows conecta e não alcança as redes

- **Área / Recurso:** VPN ([ADR 0017](adr/0017-vpn.md))
- **Severidade:** Alta
- **Plataforma:** Windows
- **Status:** ✅ Corrigido
- **Reportado em:** 2026-10-31

**Passos para reproduzir:**

1. Conectar uma VPN IPsec IKEv1 (FortiGate, túnel dividido) no Windows, com a distro `NorthVpn`.
2. Abrir uma sessão SSH para um host de uma rede do split (a mesma VPN funciona no FortiClient).

**Esperado:** o tráfego do Windows sai pelo túnel com o IP virtual e o host responde.
**Atual:** o log mostra IKE, XAuth e `CHILD_SA` estabelecidos, o North marca conectado e instala as rotas via o IP do WSL, mas o handshake SSH estoura. Não aparece `[north] WSL: … NAT`. O strongSwan registra `failed to create XFRM interface` (`Unknown device type (95)`).

**Causa raiz:** `kernel-netlink` e `kernel-libipsec` empatavam em prioridade e o netlink ficava com o IPsec. A SA ia para o XFRM do WSL, que não encaminha esse tráfego; o TUN `ipsec0` não era o caminho. O NAT dependia de rotas da tabela 220 com `src`, que o `ip` do busybox não lista, então o pacote do Windows mantinha o IP da LAN e não casava com o seletor `VIP/32`.

**Solução:** no ramo `/etc/north-wsl` do helper, `kernel-libipsec` com prioridade 2, IP virtual em `ipsec0` e SNAT do que sai por `ipsec+` para o endereço dessa interface. O `kernel-netlink` permanece para endereço e rota. Complemento no mesmo dia, com a VPN ainda sem tráfego: as distros WSL compartilham o netfilter e o Docker deixa `FORWARD` em `DROP`, então o pacote do Windows morria antes do TUN; o helper passa a aceitar `ipsec+` no topo do `FORWARD`. O Hyper-V também manda o ESP na UDP 4500 com checksum vazio (o IKE, menor, passa); o helper preenche com `CHECKSUM --checksum-fill`. Manual in-app não muda (o capítulo de VPN já descreve a conexão). O what's new fica para o bump da próxima versão: a `0.1.46` já está publicada.
**Arquivos:** `resources/vpn/north-vpn-helper`, `src/main/services/vpn/vpn-helper.test.ts`, `docs/adr/0017-vpn.md`
**Corrigido em:** 2026-10-31

### BUG-004 — Abrir o painel de log deixa a janela preta

- **Área / Recurso:** REC-004 / REC-008
- **Severidade:** Alta
- **Plataforma:** Windows
- **Status:** ✅ Corrigido
- **Reportado em:** 2026-10-31

**Passos para reproduzir:**

1. Abrir um terminal SSH.
2. Selecionar um caminho e usar **Monitorar log** (ou **Acompanhar** num arquivo gravado).

**Esperado:** a faixa de log aparece embaixo e o restante da janela continua no lugar.
**Atual:** a janela fica só com o fundo escuro e os botões de minimizar, maximizar e fechar.

**Causa raiz:** com ligaturas ligadas, o quadro cria o xterm sem `allowProposedApi`. O addon de ligaduras chama `registerCharacterJoiner`, o xterm lança `You must set the allowProposedApi option to true`, e o overlay de erro do React cobre a janela inteira. O terminal da sessão já passava essa opção; o quadro de log não.

**Solução:** o xterm do quadro usa `allowProposedApi: true`, como o terminal da sessão. O what's new fica para o bump da próxima versão.
**Arquivos:** `src/renderer/src/features/log-follow/LogFollowView.tsx`, `src/renderer/src/features/log-follow/LogFollowDock.tsx`, `src/renderer/src/features/log-follow/LogFollowWindowPage.tsx`, `src/renderer/src/assets/index.css`
**Corrigido em:** 2026-10-31

### BUG-005 — Gancho OSC 7 aparece cortado no terminal ao conectar

- **Área / Recurso:** REC-010
- **Severidade:** Baixa
- **Plataforma:** todas
- **Status:** ✅ Corrigido
- **Reportado em:** 2026-11-04

**Passos para reproduzir:**

1. Abrir uma conexão SSH salva cujo shell de login é bash ou zsh, de preferência com diretório inicial e prompt longo.
2. Olhar o terminal logo abaixo do `cd` do diretório inicial.

**Esperado:** o prompt fica limpo. O gancho que informa a pasta ao painel Arquivos não aparece.
**Atual:** uma linha cortada com `__north_osc7`, `PROMPT_COMMAND` e `MMAND` emendados, entre o `cd` e o prompt seguinte.

**Causa raiz:** depois do `cd`, o main escreve no PTY uma linha única que registra `__north_osc7` em `PROMPT_COMMAND` (bash) ou `precmd` (zsh). O tty remoto faz eco dela. A linha passa de 80 colunas (largura com que o PTY abre) e o xterm, ao quebrar e redesenhar o prompt, deixa um fragmento no scrollback. O comando já tinha rodado; o texto era só o eco.

**Solução:** o eco é retirado do fluxo antes do xterm, e só quando os bytes são exatamente o gancho. Se divergir, a saída segue inteira. O what's new fica para o bump da próxima versão. O manual não muda: não há controle novo, o comando interno deixa de aparecer.
**Arquivos:** `src/main/protocols/ssh-osc7-hook.ts`, `src/main/protocols/ssh-driver.ts`
**Corrigido em:** 2026-11-04

<!--
### BUG-XXX — <Título>

- **Área / Recurso:** REC-XXX | <área>
- **Severidade:** ...
- **Plataforma:** macOS | Windows | Linux | todas
- **Status:** 🐛 Aberto
- **Reportado em:** YYYY-MM-DD

**Passos para reproduzir:**
1. ...

**Esperado:** ...
**Atual:** ...

**Causa raiz:** ...

**Solução:** ...
**Arquivos:** `src/...`
**Corrigido em:** YYYY-MM-DD
-->
