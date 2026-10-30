# REC-001 — Modo de aparência Automático

- **Status:** 🧪 Em testes
- **Ideia de origem:** IDEIA-001
- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **ADRs:** [ADR 0012](../../adr/0012-accesses-tema-i18n.md) (contrato existente; sem ADR novo)

## Visão geral

Quarto modo de aparência, **Automático**, em Configurações → Aparência, ao lado de Escuro, Claro e Sistema. Com ele selecionado, a interface fica clara das 08:00 às 17:00 no relógio local e escura no restante do dia. A troca acontece com o app aberto, sem reiniciar. Sistema continua seguindo o tema do sistema operacional.

Quem usa o North o dia todo passa a ter claro no expediente e escuro de noite, sem depender da configuração do sistema operacional e sem trocar o tema na mão.

## Decisões

- Claro das **08:00 inclusive** até **17:00 exclusive**. Às 17:00 em ponto o tema já é escuro; às 08:00 em ponto já é claro.
- Relógio **local da máquina**. Sem fuso configurável e sem horários editáveis.
- Valor persistido: `automatic` em `ThemePreference` (`dark` | `light` | `system` | `automatic`). O literal `auto` continua inválido.
- `nativeTheme.themeSource` do Electron só aceita `dark` | `light` | `system`. No modo Automático o main grava o tema **resolvido** (`light` ou `dark`), nunca `automatic`.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | O seletor de Aparência oferece Escuro, Claro, Sistema e Automático, nos 3 locales. | Alta |
| RF-02 | Com Automático, entre 08:00 inclusive e 17:00 exclusive (hora local) a UI resolvida é clara; fora dessa janela, escura. | Alta |
| RF-03 | Com o app aberto, a virada das 08:00 e das 17:00 reaplica o tema sem reiniciar e sem o usuário reabrir Configurações. | Alta |
| RF-04 | Terminal (xterm), chrome nativo da janela e o restante da UI que já segue o tema resolvido acompanham a virada. | Alta |
| RF-05 | Se a máquina dormir além de uma virada, ao voltar o tema corresponde ao relógio atual. | Alta |
| RF-06 | Escuro, Claro e Sistema permanecem com o comportamento atual. Quem já tinha uma dessas preferências não muda até escolher Automático. | Alta |
| RF-07 | A preferência Automático sobrevive a fechar e abrir o app. | Média |

## Requisitos técnicos

- **Main:** `applyAppTheme` em `src/main/window-theme.ts` resolve `automatic` para `light` ou `dark` antes de pintar o chrome e de atribuir `nativeTheme.themeSource`. Reagenda a próxima virada e reaplica em `powerMonitor` `resume` (o padrão de suspend/resume já existe no fluxo de VPN). `src/main/ipc/theme.ts` continua validando com `isThemePreference`.
- **IPC:** nenhum canal novo. `app:set-theme` (`IpcChannels.APP_SET_THEME`) passa a aceitar `automatic` no union `ThemePreference` de `IpcInvokeMap` / `NorthApi`.
- **Shared:** regra do relógio em `src/shared/lib/theme.ts` — constantes 08:00 e 17:00, `resolveAutomaticTheme(now)` e `nextAutomaticBoundary(now)`, para main e renderer usarem a mesma conta. Testes em `src/shared/lib/theme.test.ts`.
- **Renderer:** preferência segue na store `north-ui` (`src/renderer/src/stores/ui-store.ts`). `useThemeEffect` aplica a classe `dark`/`light` no `<html>`, chama `window.north.setTheme('automatic')` e agenda a próxima virada. `useResolvedTheme` (xterm, `BrandMark`) precisa re-renderizar na virada mesmo com a preferência ainda em `automatic` — um tick não persistido na store, ou equivalente, porque o valor persistido não muda. CodeMirror que usa variáveis CSS acompanha a classe do `<html>`. Reaplicar também em `visibilitychange`, para cobrir o sono do sistema no renderer.
- **Dados:** sem migration SQLite e sem impacto em import/export. A preferência continua no persist local `north-ui`. Valor desconhecido na reidratação cai em `dark`.
- **Segurança:** preferência local de UI. Sem segredo, sem superfície de rede, sem mudança de fronteira de processo.

## Interface / UX

- Configurações → Aparência: novo item **Automático** no select existente (`SettingsPage`).
- Texto curto na descrição da seção, ou no próprio rótulo, deixando claro que claro vale das 08:00 às 17:00 no horário deste computador. Chaves novas em `settings.appearance.*` nos locales `pt-BR`, `en` e `es`.
- Estados: não há vazio, loading ou erro próprio. Preferência inválida persistida volta a Escuro.
- Sem atalho novo.

## Critérios de aceite

- [ ] O select mostra Automático e a escolha persiste depois de reabrir o app.
- [ ] Antes das 08:00 e a partir das 17:00 o tema resolvido é escuro; das 08:00 inclusive até 17:00 exclusive, claro.
- [ ] Com o app aberto na virada, `<html>`, chrome nativo e terminal mudam sem reiniciar.
- [ ] Depois de suspender além de uma virada, o tema ao voltar bate com o relógio.
- [ ] Escuro, Claro e Sistema seguem iguais para quem não escolheu Automático.
- [ ] Vitest cobre os limites 07:59, 08:00, 16:59 e 17:00 e o cálculo da próxima virada.
- [ ] Rótulos em pt-BR, en e es.

## Fora de escopo

- Horário de início/fim configurável.
- Fuso editável (vale o relógio local, inclusive horário de verão do sistema).
- Tema por workspace ou por conexão.
- Animação de transição.
- Nascer/pôr do sol ou geolocalização.

## Documentação de produto

- Manual: extensão do capítulo `getting-started` nos 3 locales (feito).
- What's new: entra no bump da próxima versão. A tag `v0.1.46` já existe; o filtro do diálogo só mostra notas até a versão do app, então não dá para anexar esta entrega ao patch já publicado.
- Engenharia: `docs/05-design-system.md` e a linha de tema em `docs/07-roadmap.md` atualizados. ADR 0012 permanece como está.
