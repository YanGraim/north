# Testes — REC-006 Cor livre e cores favoritas no seletor

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-10-31
- **Última atualização:** 2026-10-31

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] Biome nos arquivos deste recurso: `ColorPicker.tsx`, `favorite-colors.ts`, `favorite-colors.test.ts`, `ui-store.ts` e os locales `pt-BR`, `en` e `es`
- [x] `npx vitest run src/renderer/src/lib/favorite-colors.test.ts` — 10 testes (normalização, teto de 10, repetição, grade e lixo na reidratação)
- [ ] `npm run lint` no repositório inteiro — fora deste recurso. No Windows o Biome acusa CRLF no working tree (`core.autocrlf`), inclusive em arquivos que esta mudança não tocou. Os arquivos acima passaram.
- [ ] `npm run test` na suíte completa — não é critério deste recurso. A execução foi interrompida com falhas já existentes no main (VPN, agente SSH, XDG, worktree), sem relação com o seletor.
- [ ] `npm run test:e2e` — não se aplica. O seletor não tem fluxo no `e2e-harness`.

## 2. Roteiro funcional

O mesmo `ColorPicker` aparece no cadastro de cliente, ambiente, conexão, conexão de banco, acesso e tag. A lista de personalizadas é uma só, neste computador.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | No popover, digitar `#abc`, `abc`, `#aabbcc` e `AABBCC`. Confirmar com Enter e, numa outra, saindo do campo | Windows | Cada uma grava `#aabbcc`, fecha o popover e a cor fica na entidade | ✅ |
| CT-02 | Digitar `red`, `#abcd`, `#aabbccdd` e vazio. Sair do campo | Windows | Nada grava. O texto volta ao valor anterior. Não aparece erro permanente | ✅ |
| CT-03 | Sem cor, abrir a pipeta e cancelar. Depois confirmar uma cor fora da grade. Repetir com uma cor já escolhida | Windows | Sem cor, o diálogo abre em `#64748b` e cancelar não grava. Confirmar grava na entidade e põe a cor no início das personalizadas. Arrastar no Windows não enche a lista. Cor da grade não entra na lista | ✅ |
| CT-04 | Confirmar 11 cores personalizadas distintas. Confirmar de novo uma que já está na lista | Windows | A 11ª remove a mais antiga. A repetida só vai para o início, sem duplicar | ✅ |
| CT-05 | Escolher uma cor da grade. Abrir um cadastro que já tem cor livre, sem confirmar de novo | Windows | A cor da grade não entra nas personalizadas. Abrir o cadastro também não | ✅ |
| CT-06 | Botão direito numa personalizada. Com o foco nela, Delete ou Backspace. Depois Limpar | Windows | O botão direito, Delete e Backspace tiram só a amostra: a cor da entidade não muda e o popover não fecha. Não aparece o menu do navegador. Limpar zera a cor da entidade e mantém a lista. Botão direito na grade não faz nada | ✅ |
| CT-07 | Usar a mesma personalizada no cliente, no ambiente, na conexão, na conexão de banco, no acesso e na tag. Fechar e abrir o app | Windows | A lista é a mesma nos seis cadastros e continua depois de reabrir | ✅ |
| CT-08 | Trocar o idioma. Abrir o seletor desabilitado, se houver um formulário nesse estado, e um habilitado | Windows | Rótulos em pt-BR, en e es, inclusive “nenhuma”, “limpar” e o nome de cada amostra. Desabilitado não abre o popover nem o seletor do sistema | ✅ |
| CT-09 | Selecionar uma cor da grade e uma personalizada igual ao valor atual, inclusive com maiúsculas no valor já salvo | Windows | O anel aparece na amostra cujo hex normalizado coincide com o valor | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-10-31 | Homologação concluída, sem apontamento | — | ✅ |
