# Screenshots — Parte 4.5 / 5

Mocks de validação visual (não captura live do Electron). Conferir no app com `npm run dev`.

| Arquivo | Conteúdo |
| --- | --- |
| `before-connections.png` | Antes: contraste fraco, “Nova” condicional, sem hover actions |
| `after-connections.png` | Depois: tokens, Nova conexão primária, lista/detalhes refinados |
| `after-onboarding.png` | Empty state guiado (banco vazio) |
| `after-command-palette.png` | Command Palette (⌘K) estilo Raycast |

## Checklist manual

- [ ] Banco vazio → “Criar primeira conexão” → quick-create Cliente → Ambiente → Grupo
- [ ] `⌘N` abre formulário sem grupo selecionado
- [ ] Hover na lista: estrela + menu `…`
- [ ] Detalhes: Editar + Conectar (disabled)
- [ ] `⌘K` encontra host com typo e conteúdo de nota
- [ ] Tab nas conexões abre submenu de ações
