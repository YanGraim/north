# Testes — REC-008 Monitorar log da seleção

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-10-31
- **Última atualização:** 2026-11-02

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. `biome check .` neste Windows falha por CRLF no working tree (`core.autocrlf=true`; o índice está em LF). O mesmo já estava no REC-004.
- [ ] `npm run test` — `src/main/services/log-follow-service.test.ts` passou (14), inclusive path inválido, efêmero fora do teto de 8, foco por path e retry sem linha em `logFiles`. A suíte completa teve falhas já existentes de ambiente (VPN, socket Unix, XDG, `node-pty`). Nenhuma no acompanhamento de log.
- [ ] `npm run test:e2e` — não se aplica. O harness não abre um terminal SSH com seleção. Não foi executado.

## 2. Roteiro funcional

Precisa de uma conexão SSH de verdade e de um caminho de log no servidor. As ligaturas do app ligadas reproduzem o ajuste da homologação.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Terminal SSH de conexão salva, com e sem seleção | Windows | **Monitorar log** aparece. Sem seleção, fica indisponível | ✅ |
| CT-02 | Selecionar um caminho de log e usar **Monitorar log** | Windows | O quadro abre na faixa de baixo. A lista **Arquivos de log** da conexão não muda | ✅ |
| CT-03 | Repetir o clique no mesmo caminho | Windows | Não abre um segundo `tail`. O quadro que já existe continua na frente | ✅ |
| CT-04 | Fechar o quadro | Windows | O acompanhamento encerra. O path não entra na conexão | ✅ |
| CT-05 | Abrir o quadro com ligaturas ligadas | Windows | A janela continua no lugar. A faixa mostra o log | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-10-31 | Abrir o painel deixou a janela só com o fundo escuro e os botões da barra | [BUG-004](../../correcoes.md). O xterm do quadro não tinha `allowProposedApi`, exigido pelo addon de ligaduras. `src/renderer/src/features/log-follow/LogFollowView.tsx` | ✅ |
| 2026-11-02 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
