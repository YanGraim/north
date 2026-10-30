# Correções (bugs)

- **Última atualização:** 2026-10-30

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
