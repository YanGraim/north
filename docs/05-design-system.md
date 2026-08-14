# Design system

## Princípios

1. **Dark default** — o tema escuro é o padrão; light e `system` são suportados via `ui-store.theme` e classes `html.dark` / `html.light`.
2. **Densidade útil** — informação acessível sem clutter; painéis com uma função cada.
3. **Tipografia técnica** — IBM Plex Sans (UI) + IBM Plex Mono (hosts, versões, código).
4. **Sem cards no hero do produto** — superfícies por hierarquia (background → surface → elevated), não caixas genéricas.
5. **Acessibilidade** — contraste AA, foco visível (`ring` / `focus-visible`), alvos clicáveis ≥ 28–32px.
6. **Accent disciplinado** — só ações primárias, foco e destaques de match; não pintar a UI inteira.

## Tokens

### Cores (dark — default)

| Token               | Valor     | Uso                                      |
| ------------------- | --------- | ---------------------------------------- |
| `background`        | `#0a0e17` | Fundo da janela                          |
| `surface`           | `#0f1520` | Sidebar / painéis                        |
| `surface-elevated`  | `#161d2b` | Hover, itens ativos, menus               |
| `foreground`        | `#e8edf7` | Texto principal                          |
| `muted`             | `#8b97ad` | Texto secundário / metadados             |
| `border`            | `#1e2838` | Divisores sutis                          |
| `accent`            | `#3d8bfd` | Ações primárias / foco / match           |
| `accent-foreground` | `#0a0e17` | Texto sobre accent                       |
| `ring`              | `#3d8bfd` | `focus-visible`                          |

### Cores (light — slate 100)

| Token               | Valor     | Uso                                      |
| ------------------- | --------- | ---------------------------------------- |
| `background`        | `#f1f5f9` | Fundo da janela (slate-100)              |
| `surface`           | `#ffffff` | Sidebar / titlebar / diálogos            |
| `surface-elevated`  | `#e2e8f0` | Hover, itens ativos, inputs, menus       |
| `foreground`        | `#0f172a` | Texto principal (slate-900)              |
| `muted`             | `#475569` | Texto secundário / metadados (slate-600) |
| `border`            | `#cbd5e1` | Divisores (slate-300)                    |
| `accent`            | `#1a56c4` | Ações primárias / foco / match           |
| `accent-foreground` | `#ffffff` | Texto sobre accent                       |
| `ring`              | `#1a56c4` | `focus-visible`                          |

### Tipografia

| Papel        | Família       | Tamanhos típicos                         |
| ------------ | ------------- | ---------------------------------------- |
| UI / display | IBM Plex Sans | títulos 13–14 medium; corpo 13; meta 11–12 |
| Mono         | IBM Plex Mono | host/porta 12; atalhos 11                |

Uppercase + tracking só em **rótulos de seção** (sidebar, form sections, command groups).

### Espaçamento

Escala 4px: `1=4`, `2=8`, `3=12`, `4=16`, `6=24`, `8=32`.  
Headers de painel alinhados em ~48px (`h-12`); nav items e linhas de lista com padding vertical `py-2` / `py-2.5`.

### Raios

`sm=4`, `md=6`, `lg=8` — preferir cantos discretos.

### Motion

Transições padrão `150ms` (`motion-safe:duration-150`). Respeitar `prefers-reduced-motion`.

### Sombras

Mínimas; hierarquia vem de cor de superfície e bordas, não de glow.

## Layout

Três painéis:

1. **Sidebar** — seções do produto (Dashboard, Conexões, Favoritos, Recentes, Histórico) + árvore Cliente → Ambiente → Grupo + Tags; colapsada vira rail de ícones com tooltips
2. **Lista** — conexões do contexto da rota, com breadcrumb, ordenação e botão primário **Nova conexão** sempre visível
3. **Detalhes** — seções Acesso / Organização / Operação / Metadados; ações Editar + Conectar (Parte 6) no header

Titlebar frameless (`hiddenInset`) com região de drag. Painéis lista/detalhes redimensionáveis; tamanhos persistidos em `localStorage`.

## Navegação e atalhos

Rotas (HashRouter): `/dashboard`, `/connections`, `/favorites`, `/recents`, `/clients/:clientId`, `/tags/:tagId`, `/history`.  
Search params: `?env=`, `?group=` (filtros da árvore), `?connection=` (seleção compartilhada).

Atalhos (registro em `lib/shortcuts.ts`):

| Atalho | Ação |
| --- | --- |
| `Cmd/Ctrl+K` | Command palette |
| `Cmd/Ctrl+B` | Alternar sidebar |
| `Cmd/Ctrl+N` | Nova conexão |
| `Cmd/Ctrl+W` | Fechar aba de sessão |
| `Cmd/Ctrl+Shift+D` | Duplicar sessão ativa |

## Tipografia (runtime)

Fontes IBM Plex Sans/Mono via `@fontsource` (bundles locais) — sem dependência de CDN em runtime.

## Componentes base

Primitivos em `components/ui` (shadcn/new-york): `button`, `scroll-area`, `tooltip`, `separator`, `badge`, `skeleton`, `collapsible`, `resizable`, `command` (cmdk).  
`EmptyState` reutilizável para vazio/erro; `Skeleton` para carregamento.  
Command Palette em `features/command-palette` (busca fuzzy via fuse.js + índice `search:index`).

## Referências visuais

Ferramentas densas e calmas (TablePlus dark, Linear, Raycast) — não dashboards genéricos nem gradientes roxos.
