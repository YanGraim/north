# Testes — REC-004 Acompanhamento de log na conexão SSH

- **Status da homologação:** 🧪 Em testes
- **Início:** 2026-10-30
- **Última atualização:** 2026-10-30

## 1. Validações automatizadas

- [x] `npm run typecheck` (main/preload, renderer e `server`)
- [x] Vitest do recurso: normalização, comando `tail`, anel, serviço com cliente falso, migration `021`, repositório e export JSON (50 testes)
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. `biome check .` neste checkout também acusa fim de linha CRLF no restante do repositório
- [ ] `npm run test` — a suíte completa, neste Windows, teve falhas já existentes de ambiente (caminho Unix, socket, `node-pty`, drivers de VPN). Nenhuma no código deste recurso
- [ ] `npm run test:e2e` — não executado aqui. O script usa `env`, que o PowerShell não tem. O mock do harness expõe `logFollows`

## 2. Roteiro funcional

O ao vivo precisa de um SSH de verdade. O formulário e a faixa vazia podem ser vistos sem servidor.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Conexão SSH sem arquivos de log | Windows | O terminal abre como hoje. O detalhe não mostra **Acompanhar** | ⬜ |
| CT-02 | Salvar `/var/log/app.log` (ou outro arquivo que exista) e clicar **Acompanhar** | Windows | A faixa de baixo mostra linhas novas. O terminal da sessão não recebe o `tail` | ⬜ |
| CT-03 | Rotacionar o arquivo (apagar e recriar o mesmo nome) | Windows | Linhas novas continuam no quadro | ⬜ |
| CT-04 | Path com espaço e path com `'` | Windows | O servidor executa só `tail` daquele path | ⬜ |
| CT-05 | Tentar salvar `var/log/app.log` e `~outro` | Windows | O formulário não salva. `~/app/app.log` salva como `~/app/app.log` | ⬜ |
| CT-06 | **Destacar**, minimizar a janela principal, depois **Recolher** | Windows | O quadro continua visível minimizado. Recolher devolve para a faixa sem reconectar | ⬜ |
| CT-07 | Fechar o widget e encerrar o app | Windows | Fechar o widget encerra aquele SSH. Encerrar o app encerra todos | ⬜ |
| CT-08 | Host ainda não confiado | Windows | O diálogo de host key abre na janela principal. Recusar deixa o quadro em erro | ⬜ |
| CT-09 | Exportar JSON e olhar a conexão | Windows | A lista de arquivos vai no JSON. O CSV não ganha coluna | ⬜ |
| CT-10 | Trocar o idioma | Windows | Rótulos do formulário, do detalhe e do quadro em pt-BR, en e es | ⬜ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-10-31 | O quadro ficava "Ao vivo" sem linhas. Destacar deixava a janela principal preta. | `tail` agora roda num pty para despejar cada linha. Os bytes vão por `log-follows:data`, como o stdout do terminal. Ao abrir o widget, a janela principal é redesenhada. | ✅ |
