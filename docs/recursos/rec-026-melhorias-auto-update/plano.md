# Plano — REC-026 Melhorias no auto-update

- **Criado em:** 2026-11-15
- **Última atualização:** 2026-11-15
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | PR 1 `fix/updates-single-check`: reaproveitar a checagem em andamento | main | ✅ |
| 2 | PR 2 `fix/updates-translocation`: detectar AppTranslocation | main | 🔄 |
| 3 | PR 3 `feat/updates-error-codes`: códigos de erro traduzidos | shared/main/renderer | ⬜ |
| 4 | PR 4 `feat/updates-periodic-check`: checagem periódica a cada 4 h | main | ⬜ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/main/ipc/updates.ts`, `src/main/ipc/updates.test.ts`
- `src/shared/types/updates.ts`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Tocar auto-update | Atualização quebrada para todos | Escudo obrigatório em cada PR; não mudar provedor/URL/assinatura/`autoInstallOnAppQuit` |
| Checagens concorrentes | Download duplicado | PR 1 (Promise compartilhada) antes do PR 4 |

## Notas de implementação

Cada PR parte da `develop` atualizada depois do merge do anterior.
