# Testes — REC-019 Inverter botões do meio e direito no shell

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck` — `tsconfig.web.json` e `tsconfig.node.json` passaram
- [x] `npx vitest run src/renderer/src/lib/terminal/middle-button.test.ts` — 6 testes
- [x] `npx biome check` nos arquivos do gesto (`TerminalView`, `SettingsPage`, `attach-interaction`, `middle-button`)
- [ ] `npm run lint` — no working tree o Biome acusa CRLF em centenas de arquivos que este recurso não muda. O `ui-store.ts` entra nesse grupo; o diff dele é só a preferência nova
- [ ] `npm run test` — a suíte inteira teve 25 falhas em VPN, socket de agente SSH, git worktree, login item e uso do Claude. Nenhuma nesses arquivos. O teste deste recurso passou
- [ ] `npm run test:e2e` — o harness não abre o terminal nem este interruptor

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Abrir Configurações, seção Terminal, sem ter mexido no interruptor | Windows | **Botão direito copia ou cola** está desligado | ✅ |
| CT-02 | Desligado: selecionar um texto e clicar com o botão do meio. Sem seleção, clicar de novo com texto na área de transferência. Botão direito | Windows | O meio copia e cola, como no REC-018. O direito abre o menu e ainda seleciona a palavra | ✅ |
| CT-03 | Ligar o interruptor, fechar o app e abrir de novo | Windows | O interruptor continua ligado | ✅ |
| CT-04 | Ligado, num terminal SSH, selecionar um texto e clicar com o botão direito. Colar o resultado em outro lugar | Windows | O texto copiado é o da seleção, e a seleção some. O menu não abre | ✅ |
| CT-05 | Ligado, sem seleção, com texto na área de transferência, clicar com o botão direito | Windows | O texto entra no shell. O direito não seleciona uma palavra no lugar de colar | ✅ |
| CT-06 | Ligado, sem seleção, com uma imagem na área de transferência, clicar com o botão direito | Windows | Entra um caminho de arquivo, como no Ctrl+V | ✅ |
| CT-07 | Ligado, clicar com o botão do meio. Clicar de novo sobre um link, com o histórico no fim | Windows | Abre o mesmo menu (copiar, colar, cortar, selecionar tudo e, numa conexão SSH, as ações de SSH). Não copia, não cola, não rola sozinho e não abre o link | ✅ |
| CT-08 | Nos dois estados, clique esquerdo na linha atual e arrasto com o esquerdo | Windows | O esquerdo move o cursor. O arrasto seleciona | ✅ |
| CT-09 | Com um shell já aberto, desligar e ligar o interruptor e clicar de novo | Windows | O próximo clique já usa o estado novo, sem reconectar | ✅ |
| CT-10 | Repetir CT-04 e CT-07 no shell local. Clicar com o direito num arquivo do painel, fora do terminal | Windows | O shell local segue o interruptor. Fora do terminal, o direito continua o menu de sempre | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
