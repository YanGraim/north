# ADR 0002 — Biome e camada de dados (Parte 2)

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

A Parte 1 deixou ESLint + Prettier e pastas reservadas para persistência. Na Parte 2 precisamos de lint/format unificados, SQLite no main, contrato IPC de CRUD e testes da camada de dados — sem UI de inventário (Parte 3+).

## Decisões

1. **Biome no lugar de ESLint + Prettier**  
   Uma ferramenta só (`biome check` / `biome format`), estilo preservado (aspas simples, sem ponto e vírgula obrigatório, largura 100). `lint-staged` chama `biome check --write --no-errors-on-unmatched`.

2. **better-sqlite3 + migrations via `PRAGMA user_version`**  
   Banco em `userData` (`north.db` / `north-dev.db`). Migrations em TS (`{ version, up }`), aplicadas em transação no boot. Sem ORM; prepared statements nos repositórios.

3. **Zod na fronteira IPC**  
   Schemas em `src/shared/types` são a fonte dos DTOs (`z.infer`). Handlers validam com `.parse` antes de persistir.

4. **Vitest para migrations e repositórios**  
   Testes em Node contra SQLite `:memory:` — maior retorno por esforço na camada de dados.

5. **Seed de dev atrás de `NORTH_SEED=1`**  
   Só em app não empacotado e com banco vazio; cria 2 clientes e ~10 conexões para a Parte 3.

6. **Somente `credentialRef` no SQLite**  
   Nenhuma senha em claro; keychain fica na Parte 8.

## Consequências

- Qualquer CRUD novo: tipo Zod → repositório → canal IPC → método em `NorthApi` → hook TanStack Query.
- Rebuild nativo de `better-sqlite3` continua no `postinstall` (`electron-builder install-app-deps`).
- UI de inventário e FTS ficam fora desta ADR (Partes 3–5).
