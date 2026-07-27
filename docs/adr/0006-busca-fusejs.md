# ADR 0006 — Busca fuzzy com fuse.js (vs FTS5)

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

A Parte 5 exige busca global (Command Palette) sobre inventário local: conexões, clientes, ambientes, grupos e tags — incluindo campos longos (notas, descrição) e tolerância a typos.

O modelo de dados ([04-modelo-dados.md](../04-modelo-dados.md)) já antecipava FTS5 como opção. Precisávamos decidir se a busca vive no SQLite (FTS5 + triggers) ou no renderer.

## Decisão

1. **Índice achatado no main** via IPC `search:index`, agregando campos pesquisáveis (nome, host, descrição, notas, responsável, cliente, ambiente, grupo, tags) sem expor segredos.
2. **Motor fuzzy no renderer:** [fuse.js](https://fusejs.io/) com pesos (`nome` > `host` > `cliente`/`tags` > notas/descrição).
3. **Cache** no TanStack Query (`queryKeys.search.index`), invalidado pelas mutations de inventário existentes.
4. **Sem FTS5 no MVP** — o dataset típico (centenas a poucos milhares) torna fuse.js instantâneo e verdadeiramente fuzzy.

## Alternativas consideradas

| Alternativa | Motivo do descarte |
| --- | --- |
| FTS5 + triggers no SQLite | Mais infra (tabelas virtuais, sync, rebuild); fuzzy limitado sem extensão extra |
| Busca só no renderer a partir de `connections.list()` | Perderia joins de org/tags ou forçaria N queries no renderer |
| Algolia / serviço remoto | Quebra o princípio local-first |

## Gatilho para migrar a FTS5

Reavaliar quando:

- Inventários estáveis > ~10k conexões com latência perceptível no `search:index` ou no fuse
- Necessidade de ranking SQL / prefix indexes compartilhados com outras features
- Export/sync que já exija índice textual no banco

## Consequências

- Command Palette e busca compartilham o mesmo índice.
- ADR registra o trade-off: simplicidade e UX fuzzy agora; FTS5 como evolução documentada.
- Testes unitários cobrem `buildSearchIndex` e o ranking fuse no renderer.
