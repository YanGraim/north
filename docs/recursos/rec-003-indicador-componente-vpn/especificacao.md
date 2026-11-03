# REC-003 — Indicador e erros amigáveis do componente de VPN

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-003
- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **ADRs:** — (sem decisão estrutural; o contrato `vpn:helper-status` e os códigos de erro já existem no [ADR 0017](../../adr/0017-vpn.md))

## Visão geral

Na tela de VPNs, o bloco do componente passa a mostrar com clareza se ele está **instalado**, **ausente** ou **desatualizado**. Quando a instalação ou a remoção falha, a pessoa vê uma frase curta do que aconteceu e o que fazer. A linha do processo elevado (`Command failed`, `Access is denied`, caminho de `north-vpn-service.exe`) sai da tela e fica no log.

Quem instala o componente deixa de ler o erro cru do Windows, do macOS ou do Linux, e passa a saber se faltou permissão, se o pacote não trouxe o componente ou se vale tentar de novo.

## Decisões

Herdadas da IDEIA-003:

- O detalhe técnico some da tela e fica só no log.
- Vale no Windows, no macOS e no Linux.
- Nenhum canal IPC novo e nenhum código de erro novo. A UI traduz os códigos que já existem.

Fechadas na spec:

- O status continua `installed` | `missing` | `outdated` | `unsupported`, vindo de `vpn:helper-status`. `unsupported` segue sem bloco na tela.
- No Windows, `installed` continua a composição de `WindowsVpnSetup`: pacote OpenVPN presente **e** serviço North VPN no ar, com o mesmo digest do binário empacotado. A distro WSL e a pasta `openconnect/` não entram nesse status. Esta entrega não muda essa conta.
- No macOS e no Linux, o status continua o do helper root (cópia, sudoers e digest).
- Cor nunca é o único sinal. O bloco ganha um ponto (o mesmo `VpnDot` da lista) e um rótulo: Instalado, Ausente, Desatualizado. O parágrafo que já explica o status permanece.
- O botão de `outdated` passa a dizer **Atualizar** e dispara a mesma ação de instalar. `missing` continua **Conectar sem pedir senha**. `installed` continua **Remover componente de VPN**.
- A tela, o toast e o diálogo da oferta na abertura não renderizam `error.message` de `PRIVILEGE_DENIED`, `BINARY_MISSING` e `DRIVER_CRASHED`. Mostram a frase traduzida e, no componente, o que fazer.
- `CONNECTION_REJECTED`, `CERT_UNTRUSTED` e `GATEWAY_UNREACHABLE` continuam com o detalhe que já é escrito para a pessoa (e o digest do certificado).
- O log do componente é `console.error('[vpn] …')` no main, o mesmo padrão da oferta que já falha em silêncio. Não é a aba **Logs** de uma VPN: instalar o componente não é uma sessão.
- O main não tem catálogo de i18n. O diálogo da abertura (`offerHelperInstall`) continua em português, como o texto que já oferece a instalação, e sem a linha crua. Toast, aviso da VPN e o bloco do componente usam os 3 locales.
- Arquivo em uso não ganha código próprio. A frase de falha genérica do componente já diz para fechar o que estiver usando o arquivo e tentar de novo. `Access is denied` que não for cancelamento do prompt continua falha genérica: o mesmo texto do Windows serve para permissão e para arquivo travado, e classificar os dois como permissão negada mentiria.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Com status `installed`, `missing` ou `outdated`, o bloco mostra ponto, rótulo traduzido e o parágrafo que já existe. `unsupported` não mostra o bloco. | Alta |
| RF-02 | O botão de `outdated` diz Atualizar e reinstala. Os outros dois rótulos de botão permanecem. | Média |
| RF-03 | Falha ao instalar ou remover mostra uma frase traduzida do que aconteceu e o que fazer. A linha do processo não aparece no toast. | Alta |
| RF-04 | Permissão negada ou prompt cancelado usa `PRIVILEGE_DENIED`: aceitar o pedido do sistema e tentar de novo. | Alta |
| RF-05 | Instalador, serviço ou distro WSL ausentes no pacote usam `BINARY_MISSING`: reinstalar o componente na página de VPNs; se o North não trouxe o componente, reinstalar o aplicativo. O comando de build em desenvolvimento não entra na tela. | Alta |
| RF-06 | Qualquer outra falha de instalar ou remover usa a frase genérica do componente, incluindo arquivo em uso. | Alta |
| RF-07 | O aviso inline da VPN (`VpnErrorNotice`) deixa de mostrar `error.message` em `DRIVER_CRASHED` e `BINARY_MISSING`. O título traduzido e a ação (Tentar de novo) permanecem. | Alta |
| RF-08 | Se a oferta na abertura do app falhar, um diálogo curto explica o que fazer, e a linha crua vai para o log. | Média |
| RF-09 | Rótulos e frases novas em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Main:** em `VPN_HELPER_INSTALL` e `VPN_HELPER_UNINSTALL` (`src/main/services/vpn/vpn-runtime.ts`), antes do `rethrow`, classificar o erro do `elevate` / `sudo-prompt`. O `elevate` de `src/main/ipc/vpn.ts` hoje rejeita o `Error` cru; esse texto chega no toast via `formatIpcError`, sem passar por `formatVpnErrorMessage`. A classificação produz um `VpnError` e o original vai para `console.error('[vpn] helper install failed', error)` (ou `uninstall`). `offerHelperInstall` já loga assim e passa a abrir `dialog.showMessageBox` com frase curta, sem `detail` técnico.
- **Classificação** (função pura, testável, no main ou em `src/shared/lib/vpn/`): os mesmos sinais de cancelamento que `SudoPromptBroker` já usa (`did not grant permission`, `Request dismissed`, `cancel`) e o cancelamento do UAC (`canceled by the user`) viram `PRIVILEGE_DENIED`. Mensagem que já é `VpnError` desses três códigos conserva o código. O restante vira `DRIVER_CRASHED`. `BINARY_MISSING` só quando o código lançado já é esse (instalador ausente, serviço ausente no pacote, `WSL_DISTRO_MISSING`). Não reinterpretar `Access is denied` como permissão.
- **IPC:** o fio continua `[VPN:CODE] mensagem`, mas a UI do componente e o aviso desses códigos ignoram a mensagem. Nenhum canal novo. `IpcInvokeMap` não muda.
- **Renderer:** `VpnHelperCard` em `VpnsPage.tsx` ganha o ponto e o rótulo (`data-testid="vpn-helper-state"`). `useVpnHelperAction` deixa de chamar `toastError(error)` com o texto do IPC. `PRIVILEGE_DENIED` e `BINARY_MISSING` usam o título `vpn.errors.<code>`. `DRIVER_CRASHED` usa `vpn.helper.failed`, porque «Falha ao conectar a VPN» não descreve instalar ou remover. Os três levam `vpn.helper.failure.<code>` como o que fazer. Sem código reconhecido, só `vpn.helper.failed`. `VpnErrorNotice` tira `DRIVER_CRASHED` e `BINARY_MISSING` da lista que imprime `error.message`. `BINARY_MISSING` no aviso da conexão ganha a frase do que fazer (`vpn.errors.BINARY_MISSINGHint`), sem caminho de arquivo e sem o comando `build-wsl.sh`.
- **Dados:** sem migration e sem impacto em import/export.
- **Segurança:** nenhuma superfície nova. O log pode repetir o caminho do instalador e a linha do processo; não pode repetir senha. O `elevate` já não recebe segredo de VPN. Não afrouxar o prompt de administrador.

## Interface / UX

- Bloco no fim da lista de VPNs, o mesmo de hoje (`data-testid="vpn-helper"`).
- Ponto: `installed` usa o tom `connected`, `outdated` o tom `connecting`, `missing` o tom `error`. Ao lado, o rótulo. Abaixo, o parágrafo atual (`vpn.helper.installed` | `missing` | `outdated`).
- Toast de falha: título traduzido e uma segunda frase do que fazer. Sem caminho, sem `Command failed`, sem código de saída.
- Aviso inline da VPN: para `DRIVER_CRASHED`, só o título e **Tentar de novo**. Para `BINARY_MISSING`, título, a frase de reinstalar e **Tentar de novo**.
- Oferta na abertura: se a instalação falhar, diálogo em português no mesmo estilo de «Conectar VPNs sem pedir senha?», dizendo que não foi possível instalar e que dá para tentar na página de VPNs. Sem a linha do processo.
- Sem atalho novo.

## Critérios de aceite

- [x] Com o componente instalado, ausente e desatualizado, o bloco mostra rótulo e ponto correspondentes, nos 3 locales. Sem suporte de plataforma, o bloco não aparece.
- [x] Atualizar, no status desatualizado, dispara a instalação.
- [x] Cancelar o pedido de administrador mostra a frase de permissão, sem `Command failed` nem caminho de exe.
- [x] Pacote sem o instalador ou sem a distro WSL mostra a frase de componente ausente, sem `build-wsl.sh` e sem caminho.
- [x] Uma outra falha de instalar ou remover mostra a frase genérica, que cita arquivo em uso, e a linha crua só no log.
- [x] O aviso de uma VPN em `DRIVER_CRASHED` ou `BINARY_MISSING` não mostra `error.message`.
- [x] Vitest cobre a classificação: cancelamento → `PRIVILEGE_DENIED`; `VpnError` já classificado conserva o código; `Access is denied` e `Command failed` genérico → `DRIVER_CRASHED`.

## Fora de escopo

- Mudar quando o status é `installed`, `missing` ou `outdated`, inclusive fazer a distro WSL ou a pasta `openconnect/` entrarem nessa conta.
- Código de erro novo para arquivo em uso.
- Traduzir o diálogo nativo da abertura do app (continua em português, como a oferta que já existe).
- Reescrever as frases internas dos drivers («O túnel IPsec caiu», rotas recusadas). Elas deixam de aparecer na tela nesses dois códigos; o título traduzido cobre o aviso.
- Catálogo de i18n no main.
- Instalação silenciosa ou pular o pedido de administrador.

## Documentação de produto

- Manual: extensão do capítulo `vpns` nos 3 locales (feito).
- What's new: fica para o bump da próxima versão. A tag `v0.1.46` já existe, e o diálogo só mostra notas até a versão do app.
- Engenharia: adendo de 2026-10-30 no [ADR 0017](../../adr/0017-vpn.md). Sem ADR novo.

## Resultado final

Entregue em 2026-10-30. Homologação encerrada pelo usuário no mesmo dia. O único ajuste da fase de testes foi o título do toast quando a falha classificada é `DRIVER_CRASHED`: passou a ser «Não foi possível alterar o componente de VPN», com o que fazer na segunda linha. «Falha ao conectar a VPN» continua só no aviso de uma conexão.

O bloco no fim da lista de VPNs mostra ponto e rótulo (Instalado, Ausente, Desatualizado). Atualizar reinstala. Instalar ou remover que falha mostra uma frase traduzida. A linha do processo elevado fica em `console.error` no main. Se a oferta na abertura falha, um diálogo em português manda tentar de novo na página de VPNs, sem o detalhe técnico. O status `vpn:helper-status` não mudou.

Arquivos principais: `src/shared/lib/vpn/errors.ts`, `src/main/services/vpn/vpn-runtime.ts`, `src/main/ipc/vpn.ts`, `src/renderer/src/features/vpns/VpnsPage.tsx`, `src/renderer/src/features/vpns/VpnDetails.tsx`, `src/renderer/src/hooks/use-vpn.ts`.
