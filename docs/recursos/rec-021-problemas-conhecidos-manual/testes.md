# Testes — REC-021 Problemas conhecidos no manual

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck` (main/preload e renderer)
- [x] `npm run test` — `src/renderer/src/content/manual/troubleshooting.test.ts` (4 testes)
- [x] Biome nos arquivos deste recurso
`npm run test:e2e` não cobre o capítulo do manual.

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Abrir o manual | Windows | O sumário lista **Problemas conhecidos** depois de VPNs | ✅ |
| CT-02 | Abrir o capítulo | Windows | O registro do `git push` começa com a faixa **Só orientação**. A faixa não é clicável. Os dois `git config` aparecem como comando | ✅ |
| CT-03 | Em VPNs, "Quando algo dá errado", clicar em **Problemas conhecidos** | Windows | O manual troca para o capítulo novo, sem sair da página | ✅ |
| CT-04 | Repetir o capítulo em inglês e em espanhol | Windows | Título **Known issues** / **Problemas conocidos**, faixa traduzida e os mesmos dois comandos | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste no capítulo. A janela preta ao abrir o dev com o app instalado no ar era o cache do Chromium compartilhado; ficou à parte em `src/main/index.ts` | ✅ |
