# Testes — REC-003 Indicador e erros amigáveis do componente de VPN

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-10-30
- **Última atualização:** 2026-10-30

## 1. Validações automatizadas

- [x] `npm run typecheck` (main, preload, renderer e North Server)
- [x] Vitest do recurso: `classifyComponentFailure`, o fio do install/uninstall sem a linha crua, e as frases dos 3 locales (`errors.test.ts`, `vpn-runtime.test.ts`, `vpn-ui.test.ts` — 39 testes nesses arquivos)
- [ ] `npm run lint` no checkout Windows: o Biome nos arquivos deste recurso fica limpo. O repositório inteiro segue acusando CRLF (`core.autocrlf=true`), inclusive em arquivos que esta mudança não tocou.
- [ ] `npm test` completo: não foi reexecutado nesta entrega. A suíte deste recurso passou. A última suíte completa neste Windows tinha falhas pré-existentes de caminho Unix, VPN e agente SSH.
- [ ] `npm run test:e2e` — os specs de VPN passam pela tela, mas não cobrem o bloco do componente. O binário do Cypress não foi exigido para esta entrega.

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Abrir **VPNs** com o componente instalado | Windows / macOS / Linux | O bloco no fim da lista mostra ponto e o rótulo **Instalado**, o parágrafo de conectar sem senha e o botão **Remover componente de VPN** | ✅ |
| CT-02 | Componente ausente | Windows / macOS / Linux | Rótulo **Ausente**, o parágrafo de instalar uma vez e o botão **Conectar sem pedir senha** | ✅ |
| CT-03 | Componente desatualizado | Windows / macOS / Linux | Rótulo **Desatualizado** e o botão **Atualizar**, que reinstala | ✅ |
| CT-04 | Plataforma sem componente (`unsupported`) | — | O bloco não aparece | ✅ |
| CT-05 | Cancelar o pedido de administrador ao instalar ou remover | Windows / macOS / Linux | Toast de permissão negada e o que fazer (aceitar o pedido e tentar de novo). Sem `Command failed` e sem caminho de exe | ✅ |
| CT-06 | Pacote sem o instalador, o serviço ou a distro WSL | Windows | Frase de componente ausente, pedindo para reinstalar. Sem `build-wsl.sh` e sem caminho | ✅ |
| CT-07 | Outra falha ao instalar ou remover (arquivo em uso, `Access is denied`) | Windows / macOS / Linux | Frase genérica, que cita arquivo em uso. A linha crua só no console do main (`[vpn] helper install failed` ou `uninstall`) | ✅ |
| CT-08 | Uma VPN em erro `DRIVER_CRASHED` ou `BINARY_MISSING` | Windows / macOS / Linux | O aviso mostra o título traduzido (e, no segundo, a frase de reinstalar) e **Tentar de novo**. Não mostra a mensagem crua | ✅ |
| CT-09 | Trocar o idioma para English e Español | Windows / macOS / Linux | Rótulo, botão e frases de falha acompanham o idioma | ✅ |

No harness (`/vpns?scenario=app`, com uma VPN semeada) os quatro estados do bloco, o botão **Atualizar**, os toasts de permissão e de falha genérica e o aviso de `BINARY_MISSING` / `DRIVER_CRASHED` foram vistos sem a linha crua. A oferta da abertura do app (`offerHelperInstall`) e o pedido real de administrador só existem no Electron e ficam para este roteiro.

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-10-30 | No harness, o toast de `DRIVER_CRASHED` usava o título «Falha ao conectar a VPN» ao remover o componente. | O título desse caso passou a ser a frase genérica do componente; o que fazer continua na segunda linha. `use-vpn.ts` | ✅ |
| 2026-10-30 | Homologação encerrada pelo usuário, sem ajuste de código. | — | ✅ |
