# North

Workspace desktop para infraestrutura — organize clientes, ambientes e conexões (SSH, RDP, …) e conecte com velocidade, sem abrir mão de segurança local-first.

> Documentação completa em [`docs/`](./docs/).

## Stack

Electron · electron-vite · React · TypeScript · Tailwind v4 · shadcn/ui · Zustand · TanStack Query · SQLite · Biome · Zod · Vitest

## Pré-requisitos

- Node.js 22+ (recomendado)
- npm 10+

## Setup

```bash
npm install
npm run dev
```

## Scripts

| Script                                            | Descrição                            |
| ------------------------------------------------- | ------------------------------------ |
| `npm run dev`                                     | App em modo desenvolvimento (HMR)    |
| `npm run build`                                   | Typecheck + build de produção        |
| `npm run lint`                                    | Biome (lint + format check)          |
| `npm run typecheck`                               | TypeScript (main/preload + renderer) |
| `npm run test`                                    | Vitest (migrations + repositórios)   |
| `npm run format`                                  | Biome format                         |
| `npm run build:mac` / `build:win` / `build:linux` | Empacotar com electron-builder       |

## Estrutura

```
src/main       Processo main (janela, IPC, serviços)
src/preload    contextBridge → window.north
src/renderer   React UI
src/shared     Contratos IPC e tipos compartilhados
docs/          Visão, arquitetura, stack, dados, design, segurança, roadmap
.cursor/rules  Rules do agente (arquitetura, estilo, UI, IPC)
```

## IPC de exemplo

Canal `app:get-version` — definido em `src/shared/ipc`, handler no main, exposto no preload, consumido no renderer via `useAppVersion`.

## Licença

MIT
