# Testes — REC-022 Equipes e acesso por conexão

- **Status da homologação:** 🧪 Em testes
- **Início:** 2026-11-05
- **Última atualização:** 2026-11-05

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test`: 1181 testes, incluindo `workspace-access.test.ts` (conexão e servidor antigo)
- [x] `server`: `npx tsc --noEmit` e `npx vitest run` (173 testes: `rbac`, `oidc`, `migrations` 008)
- [x] `npx playwright test`: 107 testes, incluindo `admin-panel.spec.ts` e `admin-panel-entra.spec.ts`
- [x] Biome nos arquivos deste recurso. O `npm run lint` já falhava na `develop`, em arquivos fora deste recurso.

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | No painel, na página de uma pessoa, liberar uma conexão SSH como Visualizador | Web | A conexão aparece em Acessos com o caminho e o papel | ⬜ |
| CT-02 | A pessoa entra no North (desktop) | mac/Win/Linux | Ela vê só aquela conexão, conecta e não tem "revelar" nem "colar senha" | ⬜ |
| CT-03 | Criar a equipe "Suporte N1", adicionar a pessoa e liberar um grupo para a equipe | Web | Na página da pessoa, o grupo aparece "pela equipe Suporte N1" | ⬜ |
| CT-04 | Tirar a pessoa da equipe com o North aberto | mac/Win/Linux | O grupo some do North dela sem recarregar | ⬜ |
| CT-05 | Ligar a equipe a um grupo do Entra; a pessoa do grupo faz login | Web/desktop | Ela entra na equipe com o selo "pelo Entra". Exige a claim `groups` no app do Entra | ⬜ |
| CT-06 | Desktop 0.1.48 já instalado, contra o servidor atualizado | mac/Win | A organização abre como antes | ⬜ |
| CT-07 | Painel no celular (largura ~390 px) | Web | Menu no topo, listas legíveis, sem rolagem horizontal | ⬜ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
