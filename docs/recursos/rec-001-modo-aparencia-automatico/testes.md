# Testes — REC-001 Modo de aparência Automático

- **Status da homologação:** 🧪 Em testes
- **Início:** 2026-10-30
- **Última atualização:** 2026-10-30

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] Vitest de `src/shared/lib/theme.test.ts` (9 testes: limites 07:59, 08:00, 16:59, 17:00 e a próxima virada)
- [ ] `npm run lint` — neste checkout Windows o Biome acusa CRLF no repositório inteiro (`core.autocrlf=true`), inclusive em `biome.json`, que esta mudança não tocou. Os arquivos deste recurso passaram em `biome check` depois do format.
- [ ] `npm run test` — a suíte completa teve 24 falhas pré-existentes neste Windows (caminhos Unix, socket de agente SSH, helper de VPN, `/bin/sh`). Nenhuma em tema.
- [ ] `npm run test:e2e` — o seletor de Aparência não é coberto pelo Cypress.

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Configurações → Aparência | Windows | O texto cita claro das 08:00 às 17:00. O select continua em Escuro até a pessoa mudar. | ✅ |
| CT-02 | Escolher Automático com o relógio local antes das 08:00 ou a partir das 17:00 | Windows | A interface fica escura na hora, sem reiniciar. | ⬜ |
| CT-03 | Escolher Automático entre 08:00 e 17:00 | Windows | A interface fica clara na hora. | ⬜ |
| CT-04 | Deixar o app aberto na virada (08:00 ou 17:00), ou adiantar o relógio do sistema até cruzar a virada | Windows | Tema, chrome da janela e um terminal aberto mudam sem reiniciar. | ⬜ |
| CT-05 | Fechar e abrir o North | Windows | Automático continua selecionado e o tema bate com o relógio. | ⬜ |
| CT-06 | Voltar para Escuro, Claro ou Sistema | Windows | Cada um se comporta como antes. | ⬜ |

CT-01 foi visto no app em `npm run dev` às 01:49 (horário local): a seção Aparência já mostra a frase nova e o valor seguia Escuro. A troca para Automático não foi feita, para não alterar a preferência salva.

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-10-30 | CT-01 ok no app em desenvolvimento. CT-02 a CT-06 aguardam execução. | — | 🔄 |
