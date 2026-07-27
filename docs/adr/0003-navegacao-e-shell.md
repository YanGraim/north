# ADR 0003 — Navegação e shell da UI (Parte 3)

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

A Parte 2 entregou inventário via IPC/SQLite, mas a UI ainda era um `AppShell` monolítico com seleção de cliente/conexão no Zustand. Isso impedia deep-linking, histórico de navegação e a command palette (Parte 5).

## Decisões

1. **Rotas no React Router (HashRouter) em vez de seleção global**  
   Views principais são rotas: `/dashboard`, `/connections`, `/favorites`, `/recents`, `/clients/:clientId`, `/tags/:tagId`, `/history`.  
   Filtros de árvore usam search params (`?env=`, `?group=`). A conexão selecionada é `?connection=`, compartilhada por qualquer view de lista e sobrevivendo a refresh.

2. **`ui-store` só para layout**  
   Persistido em `localStorage` (`north-ui`): sidebar colapsada, nós expandidos da árvore e ordenação da lista. Seleção de domínio não mora mais no Zustand.

3. **Painéis redimensionáveis com `react-resizable-panels`**  
   Lista/detalhes via primitivos shadcn `Resizable*`. Layout persistido com `useDefaultLayout` + `localStorage`. O painel de detalhes é `collapsible` e colapsa quando não há `?connection=`.

4. **Shell componentizado por feature**  
   `components/layout` (Titlebar, ResizablePanels, AppShell) + `features/navigation|connections|history|dashboard`. Empty states/skeletons padronizados; tipografia IBM Plex via `@fontsource` (sem rede em runtime).

## Consequências

- Deep links internos (`#/clients/:id?group=…&connection=…`) são a base da command palette.
- Novas views de lista devem reutilizar `ConnectionListPage` / painel de detalhes e o contrato `?connection=`.
- CRUD, menus de contexto, palette e widgets do dashboard ficam nas Partes 4–6.
