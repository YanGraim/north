# Testes — REC-009 Diretório padrão e monitoramento no painel SFTP

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-02
- **Última atualização:** 2026-11-02

## 1. Validações automatizadas

- [ ] `npm run lint` — os arquivos deste recurso passam no Biome (`biome check` nos 8 arquivos de código, teste, i18n e Cypress, sem diagnóstico). `npm run lint` (`biome check .`) neste Windows falha com 651 erros de formato, todos CRLF (`core.autocrlf=true`; o índice está em LF). O mesmo já estava no REC-004 e no REC-008. Não foi reformatado o repositório inteiro.
- [x] `npm run typecheck` — passou (`typecheck:node` e `typecheck:web`).
- [ ] `npm run test` — `src/shared/lib/selection-path.test.ts` passou (18), inclusive `planStartupDirectoryFromPane` (path inválido, diretório atual vazio, igual com barra no fim, troca que pede confirmação, `~` diferente de home absoluto). A suíte completa: 26 falhas, 1024 passaram, 20 ignorados, 1 erro não tratado. As falhas são de ambiente (VPN/openfortivpn, socket Unix, XDG, `node-pty`, ssh-agent). Nenhuma em `selection-path` nem no painel de arquivos.
- [ ] `npm run test:e2e` — a suíte inteira não rodou. O script usa `env -u`, que não é o caminho usado aqui. O harness subiu com `npx vite --config e2e-harness/vite.config.ts` em `http://127.0.0.1:5179` e o spec rodou com `npx cypress run --spec cypress/e2e/ftp/file-browser.cy.ts` (Cypress 14.5.4, `CYPRESS_CACHE_FOLDER` em `.cypress-cache`). Resultado: 8 passando, 0 falhas, inclusive “does not offer SSH directory or log actions on the FTP panes”.

## 2. Roteiro funcional

O painel remoto de uma conexão SSH salva precisa de servidor de verdade. O plano de path e a ausência das ações no FTP já têm cobertura automática.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | `planStartupDirectoryFromPane` | Vitest | Path inválido não grava. Diretório atual vazio não pede confirmação. `/var/log/` e `/var/log` são o mesmo e não regravam. Valor diferente pede confirmação. `~` e `/home/usuario` são diferentes | ✅ |
| CT-02 | Painel FTP (remoto e local) | Cypress (Windows) | Não mostra o botão com aria-label “Definir diretório padrão” nem **Adicionar ao monitoramento** / **Monitorar em tempo real**. O menu continua com Abrir | ✅ |
| CT-03 | Painel remoto de conexão SSH salva, painel local e sessão sem conexão SSH | Windows / macOS / Linux | O botão só aparece no painel remoto SSH, antes do caminho, no tamanho dos outros. Fica indisponível enquanto a pasta ainda não foi listada. Fora disso, o botão e os dois itens não aparecem | ✅ |
| CT-04 | Diretório inicial vazio; pasta listada `/var/www/html/gruppe/storage/logs` | Windows / macOS / Linux | O botão grava esse path sem diálogo. O toast é o de diretório gravado. O rascunho do campo de caminho, antes do Enter, não entra | ✅ |
| CT-05 | Diretório inicial já preenchido | Windows / macOS / Linux | Valor diferente: Cancelar não grava; Confirmar grava só `startupDirectory`. Valor igual, inclusive com barra no fim, não regrava e avisa que já era esse | ✅ |
| CT-06 | Terminal SSH já aberto na mesma conexão; gravar o diretório pelo painel de arquivos | Windows / macOS / Linux | O terminal não recebe `cd`. A próxima abertura de arquivos usa a pasta gravada | ✅ |
| CT-07 | Um arquivo selecionado no painel remoto SSH | Windows / macOS / Linux | **Adicionar ao monitoramento** inclui o path na lista e abre o quadro. Pasta, link, outro tipo, seleção vazia ou mais de um item deixam os dois itens indisponíveis | ✅ |
| CT-08 | Path duplicado e nono arquivo | Windows / macOS / Linux | Não grava e não abre quadro. Os toasts são os de duplicata e de limite de 8 | ✅ |
| CT-09 | **Monitorar em tempo real** num arquivo | Windows / macOS / Linux | Abre o quadro e a lista **Arquivos de log** não muda. Segundo clique no mesmo path não abre outro `tail`. Com 8 quadros gravados abertos, este ainda abre | ✅ |
| CT-10 | Fechar o quadro aberto por **Monitorar em tempo real** | Windows / macOS / Linux | O acompanhamento encerra e o path não entra na conexão | ✅ |
| CT-11 | Caminho recusado por `normalizeStartupDirectory` ou `normalizeLogFilePath` | Windows / macOS / Linux | Aviso de caminho inválido. Não grava e não abre quadro. O painel continua na pasta em que está | ✅ |
| CT-12 | Trocar o idioma | Windows / macOS / Linux | Rótulos novos, diálogo e toasts em pt-BR, en e es. Baixar, Abrir, Renomear e o restante do menu de arquivos continuam em português | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-02 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
