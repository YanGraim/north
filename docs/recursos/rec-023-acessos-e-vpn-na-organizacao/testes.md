# Testes — REC-023 Acessos e VPN na organização

- **Status da homologação:** 🧪 Em testes
- **Início:** 2026-11-05
- **Última atualização:** 2026-11-05

## 1. Validações automatizadas

- [x] `npm run lint` e `npm run typecheck`
- [x] `npm run test`: inclui `workspace-copy.test.ts` (acessos e VPN contra um servidor real), `inventory-csv-import-organization.test.ts` e `workspace-access.test.ts`
- [x] `server`: `npx tsc --noEmit` e `npx vitest run`, com `accesses-vpns.test.ts` e a migration 009
- [x] `npx playwright test playwright/admin-panel*.spec.ts`, incluindo liberar um acesso só

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Na organização, Configurações → Inventário → **Copiar do Meu workspace…**, marcar dois clientes com senhas | mac/Win/Linux | Os dois aparecem na organização com conexões, bancos, logins e tags; o resumo mostra o que foi | ⬜ |
| CT-02 | Abrir um banco copiado e conectar | mac/Win/Linux | O estúdio SQL abre com a senha do servidor | ⬜ |
| CT-03 | Cliente com VPN FortiGate no Meu workspace, copiado; abrir um SSH dele na organização | mac/Win/Linux | A VPN sobe sozinha (a sua, com o seu login) | ⬜ |
| CT-04 | No painel, liberar só o banco para uma pessoa como Visualizador | Web | Na página dela aparece o banco com o caminho | ⬜ |
| CT-05 | Essa pessoa entra no North | mac/Win/Linux | Vê só o banco; conecta, mas não revela a senha. Se o banco tem VPN, a VPN aparece em VPNs sem usuário e o North pede para preencher | ⬜ |
| CT-06 | Criar uma VPN estando dentro da organização | mac/Win/Linux | A VPN é criada e aparece também no Meu workspace | ⬜ |
| CT-07 | Copiar um cliente com VPN OpenVPN | mac/Win/Linux | Copia tudo, avisa que a VPN ficou de fora | ⬜ |
| CT-08 | Desktop 0.1.50 contra o servidor atualizado | mac/Win | A organização abre e conecta como antes | ⬜ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
