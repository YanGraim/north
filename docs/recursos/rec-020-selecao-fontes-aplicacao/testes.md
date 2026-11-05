# Testes — REC-020 Seleção de fontes da aplicação

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck` — `tsconfig.node.json` e `tsconfig.web.json` passaram
- [x] `npx vitest run src/renderer/src/lib/app-font.test.ts src/renderer/src/lib/mono-font.test.ts` — 14 testes
- [x] `npx biome check` nos arquivos deste recurso (`app-font`, `ui-store`, `use-code-font-effect`, `SettingsPage`, `main.tsx`, `index.css`, `sql-codemirror-theme`, locales)
- [ ] `npm run lint` — no working tree o Biome acusa CRLF em centenas de arquivos que este recurso não muda
- [ ] `npm run test` — a suíte inteira teve 25 falhas em VPN, socket de agente SSH, git worktree, login item e uso do Claude. Nenhuma nos arquivos da fonte. Os testes deste recurso passaram
- [ ] `npm run test:e2e` — o bloco Fonte do app não tem fluxo no `e2e-harness`

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Abrir Configurações → Fonte do app sem ter escolhido a família da interface | Windows | A família da interface é Inter. A família do terminal é a mono que já estava salva. A janela está em Inter | ✅ |
| CT-02 | Trocar a interface para Roboto, Open Sans e Ubuntu, olhando a janela e um terminal já aberto | Windows | Menus, formulários e o preview da interface acompanham. O terminal não muda de face e a sessão não cai | ✅ |
| CT-03 | Escolher JetBrains Mono na interface e outra mono no terminal | Windows | A janela fica JetBrains Mono. O terminal fica na mono do segundo seletor | ✅ |
| CT-04 | Mudar o tamanho | Windows | A interface e o terminal escalam juntos | ✅ |
| CT-05 | Ligar ligaduras com a interface em Inter e o terminal em Fira Code. Digitar `=>` nos dois | Windows | O terminal junta o par. O texto da janela, em Inter, não junta | ✅ |
| CT-06 | Fechar o app e abrir de novo | Windows | As duas famílias e as ligaduras continuam como ficaram | ✅ |
| CT-07 | Abrir o autocomplete no SQL Studio ou no API Studio | Windows | A lista de sugestão continua mono, não na face da interface | ✅ |
| CT-08 | Olhar um host, uma porta e um atalho | Windows | Continuam na mono do terminal | ✅ |
| CT-09 | Comparar «Ubuntu» na interface e «Ubuntu Mono» no terminal | Windows | São rótulos e faces diferentes | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
