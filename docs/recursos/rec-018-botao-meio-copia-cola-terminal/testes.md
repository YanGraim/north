# Testes — REC-018 Botão do meio copia ou cola no terminal

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck` — `tsconfig.web.json` e `tsconfig.node.json` passaram
- [x] `npm run test` — `src/renderer/src/lib/terminal/middle-button.test.ts` (2 testes)
- [x] `npx biome check` nos arquivos deste recurso
- [ ] `npm run test:e2e` — o harness não abre o terminal

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Num terminal SSH, selecionar um texto e clicar com o botão do meio. Colar o resultado em outro lugar | Windows | O texto copiado é o da seleção, e a seleção some | ✅ |
| CT-02 | Sem seleção, com um texto na área de transferência, clicar com o botão do meio | Windows | O texto entra no shell | ✅ |
| CT-03 | Sem seleção, com uma imagem na área de transferência, clicar com o botão do meio | Windows | Entra um caminho de arquivo, como no Ctrl+V | ✅ |
| CT-04 | Botão direito no terminal. Clique esquerdo na linha atual. Arrastar com o esquerdo | Windows | O direito abre o menu. O esquerdo move o cursor. O arrasto seleciona | ✅ |
| CT-05 | Botão do meio sobre um link, e botão do meio com o histórico no fim | Windows | O link não abre. O terminal não começa a rolar sozinho | ✅ |
| CT-06 | Repetir CT-01 e CT-02 no shell local | Windows | O mesmo gesto copia e cola | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
