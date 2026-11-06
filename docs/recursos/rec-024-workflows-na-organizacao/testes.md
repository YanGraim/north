# Testes — REC-024 Workflows na organização

- **Status da homologação:** 🧪 Em testes
- **Início:** 2026-11-06
- **Última atualização:** 2026-11-06

## 1. Validações automatizadas

- [x] `npm run lint` e `npm run typecheck`
- [x] `npm run test`: `workflow-service.test.ts` (VPN e run que falha ao conectar), `workflow-store.test.ts` e `workspace-copy.test.ts` contra um servidor real
- [x] `server`: `npx tsc --noEmit` e `npx vitest run`, com `workflows.test.ts` e a migration 010
- [x] `npm run test:pw -- playwright/admin-panel.spec.ts`: liberar vários itens de uma vez e página de equipe sem "null"
- [x] `npm run test:e2e`: tudo verde menos `database/app-workspace-after-query`, que já falhava antes

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Meu workspace: rodar um workflow de um cliente com VPN, VPN desligada | mac/Win/Linux | A VPN sobe sozinha, o workflow roda, a VPN solta no fim | ⬜ |
| CT-02 | Mesmo cenário com a VPN errada (gateway fora) | mac/Win/Linux | O run termina como falha com o erro no primeiro passo | ⬜ |
| CT-03 | Na Gruppe, Copiar do Meu workspace… um cliente com workflows | mac/Win/Linux | O resumo mostra "N workflows"; no grupo aparecem os workflows e as variáveis | ⬜ |
| CT-04 | Rodar na Gruppe um workflow com rastreamento Git | mac/Win/Linux | A VPN sobe; em Últimas atualizações aparece "por Yan Raphael" | ⬜ |
| CT-05 | Outra pessoa (Visualizador do cliente) entra | mac/Win/Linux | Vê e roda os workflows, sem botões de editar; vê a atualização de quem rodou | ⬜ |
| CT-06 | Configurações na Gruppe | mac/Win/Linux | "Você em Gruppe" com papel e equipes | ⬜ |
| CT-07 | Painel admin → equipe → marcar vários clientes → Liberar N | Web | Todos aparecem em Acessos; a página não mostra "null" | ⬜ |
| CT-08 | Desktop 0.1.51 contra o servidor 0.4.0 | mac/Win | A organização abre e conecta como antes | ⬜ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
