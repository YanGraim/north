# ADR 0001 — Fundação do North (Parte 1)

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

Precisamos de um app desktop multiplataforma para inventário e lançamento de conexões de infraestrutura, com UI moderna, tipagem forte e segurança local-first.

## Decisões

1. **Scaffold com electron-vite (React + TypeScript)**  
   HMR no renderer e reload no main/preload; estrutura `main` / `preload` / `renderer` / `shared`.

2. **npm como package manager**  
   Melhor caminho para `electron-builder` e módulos nativos (`better-sqlite3`).

3. **IPC tipado por contrato em `src/shared/ipc`**  
   Canais, payloads e retornos num único lugar; preload expõe `window.north`; renderer não vê Electron.

4. **Hardening padrão**  
   `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

5. **Renderer por features + Zustand + TanStack Query**  
   Estado de UI local vs. dados assíncronos via IPC.

6. **Tailwind v4 + shadcn/ui + Lucide, tema dark-first**  
   Tokens alinhados ao design system; componentes controlados pelo repo.

7. **Banco e protocolos adiados**  
   Pastas e docs já reservam repositórios e `RemoteProtocol` para Partes 2 e 7.

## Consequências

- Qualquer feature nova que precise de I/O deve começar pelo contrato IPC.
- pnpm/yarn não são o caminho padrão (evitar atrito com nativos).
- HashRouter no renderer por compatibilidade com `file://` no build.
