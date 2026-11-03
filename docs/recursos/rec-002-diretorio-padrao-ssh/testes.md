# Testes — REC-002 Diretório padrão na conexão SSH

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-10-30
- **Última atualização:** 2026-10-30

## 1. Validações automatizadas

- [x] `npm run typecheck` (main, preload, renderer e North Server)
- [x] `npm test` no North Server (163 testes)
- [x] Vitest do recurso: `startup-directory`, migration `020`, repositório, export JSON
- [ ] `npm run lint` no checkout Windows: o Biome acusa CRLF no repositório inteiro (incluindo `biome.json`), não só nestes arquivos. `biome check` nos arquivos deste recurso fica limpo, com um info antigo de fragmento em `ConnectionDetailsPanel` que já existia.
- [ ] `npm test` completo: 951 passaram. 25 falharam em testes de Linux, VPN e agente SSH que não usam este campo (caminho XDG, `openfortivpn`, socket de agente no Windows).
- [ ] `npm run test:e2e` — o spec `cypress/e2e/ftp/file-browser.cy.ts` cobre o `FileBrowserView`, mas o binário do Cypress não está em `.cypress-cache` nesta máquina (`cypress install` ainda não foi rodado).

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Conexão SSH sem diretório inicial | Windows / macOS / Linux | Terminal e **Abrir arquivos (SFTP)** abrem no diretório de login, como antes | ✅ |
| CT-02 | Diretório inicial `/tmp` (ou outra pasta que exista) | Windows / macOS / Linux | O prompt do terminal já está nessa pasta e o painel remoto do SFTP também. O botão home do SFTP volta para o login | ✅ |
| CT-03 | Diretório inicial `~/uma-pasta` que exista | Windows / macOS / Linux | Terminal e SFTP abrem nela. O valor salvo continua `~/uma-pasta`, não o caminho absoluto | ✅ |
| CT-04 | Diretório que não existe | Windows / macOS / Linux | A sessão conecta. O terminal mostra a linha amarela `[North]` e não executa o `cd`. O SFTP abre no login e mostra um aviso | ✅ |
| CT-05 | Caminho com espaço e com `'` | Windows / macOS / Linux | O `cd` trata o texto como um único path. Nada além do `cd` roda | ✅ |
| CT-06 | Salvar `var/log` ou `~outro` | Windows / macOS / Linux | O formulário recusa, nos três idiomas do rótulo | ✅ |
| CT-07 | Campo vazio, ou apagar o valor | Windows / macOS / Linux | Salva sem diretório. A próxima sessão abre no login | ✅ |
| CT-08 | Exportar o inventário JSON e importar de novo | Windows / macOS / Linux | O diretório inicial volta na conexão SSH | ✅ |
| CT-09 | Conexão SFTP ou FTP de protocolo próprio | Windows / macOS / Linux | O formulário não mostra o campo. O navegador abre no login | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-10-30 | Homologação do roteiro funcional | Nenhum ajuste de código | ✅ |
