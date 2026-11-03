# Plano — REC-006 Cor livre e cores favoritas no seletor

- **Criado em:** 2026-10-31
- **Última atualização:** 2026-10-31
- **Homologação:** encerrada em 2026-10-31, sem ajuste de código. O what's new continua para o bump da próxima versão.
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `normalizeHexColor` e `rememberFavoriteColor` + Vitest | renderer | ✅ |
| 2 | `favoriteColors` na store `north-ui` (`partialize` + `merge`) | renderer | ✅ |
| 3 | Campo, pipeta nativa, faixa de personalizadas e chaves `colorPicker.*` (pt-BR, en, es) | renderer | ✅ |
| 4 | Manual `organization` (3 locales). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

Sem migration, sem canal IPC e sem alteração nos formulários: eles já delegam a cor ao `ColorPicker`.

## Arquivos-chave

- `src/renderer/src/components/ColorPicker.tsx`
- `src/renderer/src/lib/entity-colors.ts` (a lista não muda; o seletor continua importando ela)
- `src/renderer/src/lib/favorite-colors.ts` (novo)
- `src/renderer/src/lib/favorite-colors.test.ts` (novo)
- `src/renderer/src/stores/ui-store.ts`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/organization.md`
- Formulários que só montam o componente: `ClientFormDialog.tsx`, `EnvironmentFormDialog.tsx`, `ConnectionFormDialog.tsx`, `DatabaseConnectionFormDialog.tsx`, `AccessFormDialog.tsx`, `TagFormDialog.tsx`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| `input` do picker nativo dispara enquanto se arrasta a cor | A lista enche de intermediários e estoura as 10 | Gravar só no `change` |
| Pipeta dentro do botão do popover | Clique inválido ou popover abrindo junto com o diálogo | Botão irmão; `stopPropagation` não precisa segurar um botão aninhado |
| `favoriteColors` reidratado com lixo ou mais de 10 itens | Amostra quebrada ou faixa longa | `merge` filtra com a mesma normalização, deduplica e corta em 10 |
| Cor livre já salva noutra máquina | Não aparece nas personalizadas deste computador | Esperado: a lista é local. A entidade continua mostrando o hex no gatilho |
| Comparar `#AABBCC` com a grade em minúsculas | Anel de seleção some, ou a cor da grade entra nas personalizadas | Normalizar para `#rrggbb` antes de comparar e de guardar |

## Notas de implementação

- Sem ADR: reaproveita o campo `color` e a store local. Nenhuma dependência nova.
- `test:e2e` não entra neste recurso. O seletor não tem fluxo no `e2e-harness`; a regra pura fica no Vitest e o popover, na homologação.
- O what's new espera o bump da próxima versão, no mesmo critério do REC-001: o diálogo só mostra notas até a versão do app.
- 2026-10-31: manual `organization` atualizado em pt-BR, en e es. What's new continua pendente até o bump.
