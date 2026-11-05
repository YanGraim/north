# Testes — REC-016 Diretórios favoritos no painel de arquivos

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test` — `connection-directory-favorites-repository.test.ts`, `migrations.test.ts` e `inventory-json.test.ts` (28 testes). A suíte completa: 24 falhas, 1108 passaram, 20 ignorados, 1 erro não tratado. As falhas são de ambiente (VPN/openfortivpn, socket Unix, XDG, `node-pty`). Nenhuma neste recurso.
- [x] `npm run test:e2e` — `cypress/e2e/ftp/file-browser.cy.ts` (12 testes), inclusive salvar um favorito, voltar a ele e remover. O painel local não mostra o botão.
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. `biome check .` neste checkout acusa fim de linha CRLF no restante do repositório.

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | No SFTP de uma conexão salva, em `/var/www/html`, acrescentar a pasta. Ir a outra pasta e clicar o favorito | Windows | A lista mostra `/var/www/html`. O clique volta a essa pasta | ✅ |
| CT-02 | Remover esse favorito | Windows | Sai da lista. A pasta no servidor continua | ✅ |
| CT-03 | Acrescentar de novo com barra no fim (`/var/www/html/`) | Windows | Não cria outra linha. Avisa que a pasta já é um favorito | ✅ |
| CT-04 | Tentar gravar um caminho que o painel não está listando, se aparecer um caminho relativo | Windows | Não grava e avisa. No uso normal o botão só oferece a pasta já listada | ✅ |
| CT-05 | Apagar a pasta no servidor e clicar o favorito | Windows | Avisa e o painel fica na pasta que já estava aberta | ✅ |
| CT-06 | Abrir outra conexão, duplicar a primeira e exportar o inventário | Windows | A outra conexão e a cópia não têm a lista. O export não traz esses caminhos. O diretório inicial não muda | ✅ |
| CT-07 | Olhar o painel local e o painel da badge Arquivos no terminal | Windows | Nenhum dos dois tem o botão | ✅ |
| CT-08 | Repetir acrescentar, abrir e remover no FTP | Windows | O mesmo fluxo do SFTP | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
