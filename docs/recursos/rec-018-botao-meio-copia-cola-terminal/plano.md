# Plano — REC-018 Botão do meio copia ou cola no terminal

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `auxclick` do botão 1 em `attachTerminalInteraction`: copia se há seleção, senão cola | renderer | ✅ |
| 2 | `preventDefault` para segurar a rolagem automática e o reposicionamento da seleção primária | renderer | ✅ |
| 3 | Vitest da escolha copiar/colar | test | ✅ |
| 4 | Manual (`connect`, seção Terminal) nos 3 locales. What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

Não há contrato IPC, preload, migration nem serviço no main. Não há rótulo novo de interface.

## Arquivos-chave

- `src/renderer/src/lib/terminal/attach-interaction.ts`
- `src/renderer/src/lib/terminal/clipboard.ts` (`copyTerminalSelection`, `pasteClipboardIntoTerminal` — reutilizar, sem mudar o contrato)
- `src/renderer/src/features/sessions/TerminalView.tsx` (já chama `attachTerminalInteraction`; o gesto não pede prop nova)
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| A rolagem automática do Chromium começar no `mousedown`, antes do `auxclick` | O terminal rola ao copiar ou colar | `preventDefault` também no `mousedown` do botão 1, se o `auxclick` não bastar |
| O xterm, no Linux, colar a seleção primária e reposicionar o texto | O gesto não copia para a área de transferência do sistema | `preventDefault` no clique do meio; copiar e colar usam as funções que já falam com `navigator.clipboard` |
| O addon de links abrir a URL no botão do meio | Um clique de copiar sai do app | O handler do meio não chama `openTerminalLink`; o clique esquerdo do addon permanece |
| O `preventDefault` do meio atingir o botão direito | O menu deixa de abrir | O listener só age com `button === 1`. O click-to-move já ignora qualquer botão que não seja o esquerdo |

## Notas de implementação

`copySelection` e `paste` já estão fechados dentro de `attachTerminalInteraction` e são os mesmos do menu e dos atalhos. A escolha pura ficou em `resolveMiddleButtonAction`.

O gesto em si corre no `mouseup` do botão 1, com o `mousedown` em captura chamando `preventDefault`. No Chromium, cancelar o `mousedown` segura a rolagem automática e pode suprimir o `auxclick`; por isso a ação não depende só desse evento. O `auxclick` continua sendo engolido em captura: no Linux o xterm reposiciona a textarea nesse evento e não olha `defaultPrevented`. Se o `mouseup` não tiver tratado o clique, o `auxclick` ainda copia ou cola.

O harness Cypress não abre essa tela. O gesto entra no roteiro de `testes.md`.
