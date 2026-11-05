# Testes — REC-015 Caminho clicável no painel de arquivos

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test` — `paths.test.ts` (5 testes, incluindo `pathSegments`)
- [ ] `npm run test` completo — 25 falhas já existentes nesta máquina (caminho Unix, socket, OpenVPN/OpenFortiVPN). Nenhuma em `paths.test.ts`
- [x] `npm run test:e2e` — `cypress/e2e/ftp/file-browser.cy.ts` (11 testes, inclusive o da barra)
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. O `biome check .` deste checkout segue com o problema de fim de linha já anotado no REC-012

## 2. Roteiro funcional

O Cypress cobre o painel remoto POSIX do harness (clique em `/`, digitar `/docs`, Esc e blur). O app no Windows foi homologado em 2026-11-04, inclusive a raiz `C:\`, o espelho do terminal e os rótulos em en e es.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | No painel remoto, abrir `/var/www/html` e clicar em `www`, depois em `/` | Windows | A lista vai para `/var/www` e depois para `/` | ✅ |
| CT-02 | No painel local, com um caminho `C:\Users\…`, clicar em `Users` e em `C:\` | Windows | A lista vai para `C:\Users` e depois para `C:\`. O rótulo da raiz é `C:\` | ✅ |
| CT-03 | Clicar no trecho final, digitar outro caminho e confirmar com Enter. Repetir e apertar Esc | Windows | Enter lista o caminho digitado. Esc volta aos trechos da pasta que já estava aberta, sem listar de novo | ✅ |
| CT-04 | Subir um nível e ir para a pasta inicial | Windows | Os dois botões continuam listando a pasta esperada | ✅ |
| CT-05 | No terminal SSH, abrir a badge **Arquivos** com a pasta do shell já conhecida | Windows | A barra é um campo só leitura, sem trecho clicável, e a pasta não muda | ✅ |
| CT-06 | Trocar o idioma do app para en e para es e olhar a barra | Windows | O trecho anterior se chama "Open {caminho}" / "Abrir {ruta}". O campo se chama "Path" / "Ruta" | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
