# Testes — REC-017 Ações de SFTP no painel da pasta do terminal

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test` — `shell-prompt-gate.test.ts`, `terminal-cwd-copy.test.ts`, `ssh-directory-list.test.ts`, `startup-directory.test.ts` e `osc7-cwd.test.ts` (41 testes)
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. `biome check .` neste checkout acusa fim de linha CRLF no restante do repositório
- [ ] `npm run test` completo — a suíte tem 25 falhas e 1 erro já existentes nesta máquina (XDG, pid do Claude, socket de agente, openfortivpn, `node-pty` AttachConsole). Nenhuma é deste recurso
- [ ] `npm run test:e2e` — a badge e o aviso sem OSC 7 já estão em `app-workspace-after-query.cy.ts`; o FTP continua sem a badge em `file-browser.cy.ts`. Não foi reexecutado nesta sessão

## 2. Roteiro funcional

Precisa de um terminal SSH salvo, com bash ou zsh, e o painel **Arquivos** aberto depois que a pasta chegou.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Com o shell em `/var`, entrar em `log` | Windows | O terminal mostra `cd -- '/var/log'`. A lista só passa a `/var/log` quando o prompt confirmar | ✅ |
| CT-02 | Digitar texto sem Enter e clicar numa pasta. Fechar a badge antes do Enter | Windows | O clique não completa a linha. Fechar a badge não escreve `cd` | ✅ |
| CT-03 | Com texto na linha, clicar numa pasta e só então dar Enter | Windows | O `cd` sai no prompt seguinte, não no meio da linha | ✅ |
| CT-04 | Abrir `vim` (ou outro comando) e clicar numa pasta. Sair do comando | Windows | Nada é escrito no `vim`. O `cd` espera o próximo prompt | ✅ |
| CT-05 | Subir, pasta inicial, trecho do caminho e Enter num absoluto | Windows | Cada um escreve `cd` citado. Um caminho relativo avisa e não escreve | ✅ |
| CT-06 | Nova pasta, renomear e excluir | Windows | O servidor muda, a lista atualiza, o terminal não recebe comando. Excluir pede confirmação | ✅ |
| CT-07 | Baixar um arquivo e enviar por seletor e por arraste | Windows | Baixar pede a pasta local. Enviar cai na pasta do prompt | ✅ |
| CT-08 | Definir diretório inicial e as duas ações de log | Windows | Igual ao painel SFTP da mesma conexão. Não escreve `cd` | ✅ |
| CT-09 | Abrir a badge antes do primeiro prompt | Windows | Continua o aviso do REC-010. Não há `cd` | ✅ |
| CT-10 | FTP, terminal local e o navegador de dois lados | Windows | Não ganham este `cd`. Neste painel não aparecem favoritos nem **Editar** | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Homologado pelo usuário, sem ajuste de código | — | ✅ |
