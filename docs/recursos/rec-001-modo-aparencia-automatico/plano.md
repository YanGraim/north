# Plano — REC-001 Modo de aparência Automático

- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `automatic` em `ThemePreference`, `resolveAutomaticTheme` e `nextAutomaticBoundary` + Vitest dos limites | shared | ✅ |
| 2 | `applyAppTheme` resolve o relógio, agenda a próxima virada e reaplica no `resume` | main | ✅ |
| 3 | `useThemeEffect` + tick para `useResolvedTheme` reagir com a preferência ainda em `automatic` | renderer | ✅ |
| 4 | Item Automático no select e chaves `settings.appearance.*` (pt-BR, en, es) | renderer | ✅ |
| 5 | Manual `getting-started` (feito). What's new fica para o bump da próxima versão | docs | 🔄 |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

O manual já está no capítulo `getting-started`. O what's new entra no bump da próxima versão. O roteiro está em `testes.md`.

## Arquivos-chave

- `src/shared/lib/theme.ts`
- `src/shared/lib/theme.test.ts`
- `src/shared/ipc/contract.ts` (o union `ThemePreference` já entra no canal `app:set-theme`; sem canal novo)
- `src/main/window-theme.ts`
- `src/main/ipc/theme.ts`
- `src/renderer/src/stores/ui-store.ts`
- `src/renderer/src/hooks/use-theme-effect.ts`
- `src/renderer/src/lib/xterm-theme.ts` (`useResolvedTheme`)
- `src/renderer/src/components/BrandMark.tsx`
- `src/renderer/src/features/settings/SettingsPage.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/getting-started.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| A preferência continua `automatic` na virada, então quem só observa `theme` na store (xterm, marca) não re-renderiza | Terminal fica no tema antigo até um reload | Tick não persistido na store, consumido por `useResolvedTheme` e pelo efeito de classe |
| `setTimeout` não dispara durante o sono | Tema atrasado ao abrir a tampa | Na volta, resolver pelo relógio atual (`visibilitychange` no renderer, `powerMonitor` `resume` no main), não pelo lado da virada que estava agendado |
| `themeSource = 'automatic'` | Chrome nativo ignorado ou erro | Main só atribui `light` ou `dark` |
| Relógio atrasado/adiantado ou horário de verão | Virada deslocada | Usar `Date` local (`setHours`); a próxima virada é recalculada a cada aplicação |

## Notas de implementação

- Janela clara: hora local ≥ 08:00 e < 17:00. Minutos e segundos contam: 16:59:59 ainda é claro; 17:00:00 já é escuro.
- `nextAutomaticBoundary`: antes das 08:00 → 08:00 de hoje; das 08:00 inclusive até antes das 17:00 → 17:00 de hoje; das 17:00 em diante → 08:00 do dia seguinte.
- Delay máximo entre viradas é ~15 h, abaixo do teto de `setTimeout`.
- CodeMirror de SQL/API usa variáveis CSS e acompanha a classe do `<html>`; não precisa de tema próprio na virada.
- Sem ADR novo: estende o contrato de tema do ADR 0012, sem schema, rede ou fronteira de processo.
