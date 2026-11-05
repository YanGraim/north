# Plano — REC-019 Inverter botões do meio e direito no shell

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Preferência na store `north-ui`, padrão desligado, persistida | renderer | ✅ |
| 2 | Interruptor na seção Terminal + rótulos nos 3 locales | renderer | ✅ |
| 3 | Com a preferência ligada: direito copia ou cola, meio abre o menu, `rightClickSelectsWord` desligado | renderer | ✅ |
| 4 | Vitest da escolha de botão conforme a preferência | test | ✅ |
| 5 | Manual (`connect`, seção Terminal) nos 3 locales. What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

Não há contrato IPC, preload, migration nem serviço no main.

## Arquivos-chave

- `src/renderer/src/stores/ui-store.ts`
- `src/renderer/src/features/settings/SettingsPage.tsx`
- `src/renderer/src/i18n/locales/{pt-BR,en,es}.json` (`settings.terminal`)
- `src/renderer/src/lib/terminal/middle-button.ts` (`resolveMiddleButtonAction` — reutilizar)
- `src/renderer/src/lib/terminal/attach-interaction.ts`
- `src/renderer/src/features/sessions/TerminalView.tsx` (`rightClickSelectsWord`)
- `src/renderer/src/features/sessions/TerminalContextMenu.tsx`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| `rightClickSelectsWord` selecionar a palavra no `mousedown`, antes do copiar ou colar | O direito copia uma palavra em vez de colar | A opção fica `false` enquanto a preferência está ligada, inclusive numa sessão já aberta |
| O `contextmenu` do Radix abrir junto com o gesto de copiar | Os dois acontecem no mesmo clique | O listener em captura cancela o evento quando a preferência está ligada |
| O meio, no modo invertido, ainda passar por `attachMiddleButton` e colar | O menu não abre e o shell recebe texto | Esse caminho só copia ou cola com a preferência desligada. Ligada, o `mouseup` do botão 1 abre o menu e o `preventDefault` da rolagem permanece |
| O xterm, no Linux, reposicionar a textarea no `auxclick` do meio | O menu abre e o foco do terminal se perde | O `auxclick` do botão 1 continua engolido, como no REC-018 |

## Notas de implementação

A preferência é `terminalRightButtonCopies` na store `north-ui`. Nasce desligada. A escolha copiar ou colar continua `resolveMiddleButtonAction`. `resolveTerminalPointerRole` decide qual botão faz o quê.

O clique lê a store na hora. `term.options.rightClickSelectsWord` também muda quando o interruptor muda, sem recriar o xterm. No `mousedown` do direito, a opção é reaplicada em captura, antes de o xterm ler ela.

Com a preferência ligada, o `contextmenu` do botão 2 é cancelado em captura e copia ou cola. O menu do meio é o mesmo `TerminalContextMenu`: o `mouseup` do botão 1 dispara um `contextmenu` no container, com `button` 0, para esse listener não tratar o evento como copiar ou colar. O Radix posiciona o menu no ponto do clique.
