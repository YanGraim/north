# Testes — REC-010 Arquivos do diretório atual ao lado do terminal

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-02
- **Última atualização:** 2026-11-03

## 1. Validações automatizadas

- [ ] `npm run lint` — nesta máquina o comando inteiro falha com 647 erros de formatação CRLF→LF (`core.autocrlf=true`). Os arquivos deste recurso passam em `npx biome check` (um aviso antigo em `contract.ts`, `result: void`, que já existia).
- [x] `npm run typecheck`
- [ ] `npm run test` — a suíte completa teve 25 falhas fora deste recurso (caminhos Linux/macOS e binários de VPN neste Windows). Os testes novos de OSC 7, do gancho, da listagem e dos rótulos passaram.
- [x] `npm run test:e2e` — 45 testes, todos verdes. O script do `package.json` usa `env`, que o PowerShell não tem; a mesma sequência rodou com `ELECTRON_RUN_AS_NODE` removido e `CYPRESS_CACHE_FOLDER` apontando para `.cypress-cache`.

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Terminal SSH de conexão salva mostra a badge **Arquivos** | Windows (harness) | `[data-testid="terminal-cwd-toggle"]` visível com o texto Arquivos | ✅ |
| CT-02 | Abrir a badge antes de qualquer OSC 7 | Windows (harness) | Aviso de espera visível; o painel não monta `file-pane-remote` | ✅ |
| CT-03 | Fechar a badge | Windows (harness) | `terminal-cwd-panel` some | ✅ |
| CT-04 | Barra do workflow | Windows (harness) | A barra não contém `terminal-cwd-toggle` | ✅ |
| CT-05 | Navegador FTP | Windows (harness) | O navegador de dois lados não contém `terminal-cwd-toggle` | ✅ |
| CT-06 | `parseOsc7Cwd` | Vitest | Host ignorado, `%20` e `%2F`, relativo recusado, scheme que não é `file` recusado, vazio que não vira `/` | ✅ |
| CT-07 | Gancho só para bash e zsh | Vitest | Acrescenta `PROMPT_COMMAND` / `precmd_functions`, não grava rc, fish/dash/ash e sessão sem conexão não escrevem, falha da leitura não derruba o passo | ✅ |
| CT-08 | `sessions:list-directory` | Vitest | Path inválido não abre SFTP; arquivo ausente é `missing`; outro erro é `unavailable` sem a mensagem do ssh2; `end()` no fim | ✅ |
| CT-09 | Rótulos | Vitest | pt-BR, en e es iguais à tabela da spec | ✅ |
| CT-10 | Bash num SSH salvo: badge, pasta `/var`, depois `cd /var/log` | macOS / Windows / Linux | A lista troca de `/var` para `/var/log`. O gancho não está em `.bashrc` | ✅ |
| CT-11 | Zsh no mesmo fluxo | macOS / Windows / Linux | OSC 7 atualiza a lista. O gancho não está em `.zshrc` | ✅ |
| CT-12 | Clique numa pasta do painel | macOS / Windows / Linux | O terminal não recebe `cd` e a lista continua na pasta do OSC 7 | ✅ |
| CT-13 | Fechar e abrir de novo | macOS / Windows / Linux | Fechado não lista. Aberto de novo mostra a pasta corrente | ✅ |
| CT-14 | Fish, dash ou ash | macOS / Windows / Linux | O trecho de bash/zsh não entra. O painel fica no aviso, sem o diretório de login | ✅ |
| CT-15 | SFTP da listagem falha | macOS / Windows / Linux | O painel mostra o aviso de listagem e o terminal continua utilizável | ✅ |
| CT-16 | Shell local, Telnet, serial, workspace de agente, RDP e o navegador SFTP de dois lados | macOS / Windows / Linux | Sem badge e sem gancho | ✅ |

Roteiro de sessão que continua valendo: [09-qa.md](../../09-qa.md) (SSH in-app) e [11-validacao-pratica.md](../../11-validacao-pratica.md).

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-03 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
