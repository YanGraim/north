# Design system

## Princípios

1. **Dark-first** — o tema escuro é o padrão; light é opcional e posterior.
2. **Densidade útil** — informação acessível sem clutter; painéis com uma função cada.
3. **Tipografia técnica** — IBM Plex Sans (UI) + IBM Plex Mono (hosts, versões, código).
4. **Sem cards no hero do produto** — superfícies por hierarquia (background → surface → elevated), não caixas genéricas.
5. **Acessibilidade** — contraste AA, foco visível (`ring`), alvos clicáveis ≥ 28–32px.

## Tokens

### Cores (dark)

| Token               | Valor     | Uso                    |
| ------------------- | --------- | ---------------------- |
| `background`        | `#0a0e17` | Fundo da janela        |
| `surface`           | `#0f1520` | Sidebar / detalhes     |
| `surface-elevated`  | `#161d2b` | Hover, itens ativos    |
| `foreground`        | `#e8edf7` | Texto principal        |
| `muted`             | `#8b97ad` | Texto secundário       |
| `border`            | `#1e2838` | Divisores              |
| `accent`            | `#3d8bfd` | Ações primárias / foco |
| `accent-foreground` | `#0a0e17` | Texto sobre accent     |

### Tipografia

| Papel        | Família       | Tamanhos típicos  |
| ------------ | ------------- | ----------------- |
| UI / display | IBM Plex Sans | 12 / 14 / 16 / 20 |
| Mono         | IBM Plex Mono | 12 / 13           |

### Espaçamento

Escala 4px: `1=4`, `2=8`, `3=12`, `4=16`, `6=24`, `8=32`.

### Raios

`sm=4`, `md=6`, `lg=8` — preferir cantos discretos.

### Sombras

Mínimas; hierarquia vem de cor de superfície e bordas, não de glow.

## Layout

Três painéis:

1. **Sidebar** — árvore Cliente / Ambiente / Grupo
2. **Lista** — conexões do contexto selecionado
3. **Detalhes** — formulário / metadados / ações da conexão

Titlebar frameless (`hiddenInset`) com região de drag.

## Referências visuais

Ferramentas densas e calmas (TablePlus dark, Linear, Raycast) — não dashboards genéricos nem gradientes roxos.
