# ADR 0011 — Settings e release

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

O MVP (Partes 1–10) entregou inventário, sessões in-app, import/export e hooks de auto-update, mas a sidebar ainda apontava Configurações como “em breve”. Faltava uma superfície única para versão, inventário, updater e sobre — sem duplicar a lógica já usada na command palette.

## Decisões

1. **Uma página `/settings` estilo Linear** — seções Gerais, Inventário, Atualizações e Sobre numa coluna estreita; sem “settings mega-app” nem preferências profundas nesta faixa.
2. **Helpers compartilhados** — `lib/inventory-actions.ts` e `lib/update-actions.ts` concentram invoke + toast + invalidação de cache; palette e Settings só orquestram.
3. **Release documentado em** [10-distribuicao.md](../10-distribuicao.md) — GitHub Releases, updater em build empacotado, signing/notarize opt-in (`notarize: false` até haver certificados).
4. **QA manual** em [09-qa.md](../09-qa.md) complementar ao smoke `lint` / `typecheck` / `test`.

## Consequências

- Deep link `#/settings` entra no contrato de rotas do shell ([ADR 0003](./0003-navegacao-e-shell.md)).
- Preferências futuras (atalhos editáveis, tema, etc.) estendem a mesma página sem novo topo de navegação.
