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

| Script | Descrição |
| --- | --- |
| `npm run dev` | App em modo desenvolvimento (HMR) |
| `npm run build` | Typecheck + bundle de produção → `out/` |
| `npm run dist` | `build` + instalador da plataforma atual → `release/` |
| `npm run dist:mac` / `dist:win` / `dist:linux` | Empacotar (DMG / NSIS / AppImage) |
| `npm run dist:dir` | App unpacked (`--dir`) para smoke rápido |
| `npm run lint` | Biome (lint + format check) |
| `npm run typecheck` | TypeScript (main/preload + renderer) |
| `npm run test` | Vitest (migrations + repositórios) |
| `npm run format` | Biome format |

Convenção: `build` = só compilação; `dist*` = instaladores. Detalhes e limitações (cross-compile, signing, userData `North`) em [docs/10-distribuicao.md](./docs/10-distribuicao.md).

### Gerar instaladores (incluindo `.exe` no Mac)

Build local só na plataforma atual. Para Windows/Linux a partir do Mac, use o CI:

```bash
git tag v0.1.0
git push origin v0.1.0
```

O workflow [`.github/workflows/release.yml`](./.github/workflows/release.yml) gera DMG, NSIS (`.exe`) e AppImage em paralelo e abre um **draft release** no GitHub.

Runbook rápido:

1. Confirmar `version` em `package.json`.
2. Criar e publicar tag semântica (`git tag vX.Y.Z && git push origin vX.Y.Z`).
3. Acompanhar **Actions → Release** até concluir os jobs `verify`, `build` e `release`.
4. Abrir o draft release e validar presença de:
   - macOS: `.dmg`, `.zip`, `*.blockmap`
   - Windows: `North-*-setup.exe` e `*.blockmap`
   - Linux: `.AppImage` e `*.blockmap`
   - Metadados do updater quando gerados (`latest*.yml`)
5. Publicar manualmente o release após QA.

## Estrutura

```
src/main       Processo main (janela, IPC, database, repositórios)
src/preload    contextBridge → window.north
src/renderer   React UI + hooks TanStack Query
src/shared     Contratos IPC, tipos Zod e protocolos
docs/          Visão, arquitetura, stack, dados, design, segurança, roadmap, QA, distribuição, ADRs
```

## Docs úteis

- [Roadmap](./docs/07-roadmap.md) — MVP fechado + pós-MVP / release
- [QA](./docs/09-qa.md) — checklist manual por protocolo
- [Validação prática](./docs/11-validacao-pratica.md) — roteiro preenchível em ambientes reais
- [Distribuição](./docs/10-distribuicao.md) — electron-builder, GitHub Releases, updater, signing

## IPC



API agrupada em `window.north` (`clients`, `environments`, `groups`, `connections`, `tags`, `history`, `inventory`, `updates`) — contrato em `src/shared/ipc`. Seed de dev: `NORTH_SEED=1 npm run dev`.

## Licença

MIT
