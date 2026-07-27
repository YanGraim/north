# ADR 0010 — Import/export e auto-update

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

O MVP precisa de backup/restauração do inventário sem vazar segredos, e de distribuição com instaladores + atualização opt-in.

## Decisão

1. **Export JSON schemaVersion 1** — árvore clientes → ambientes → grupos → conexões + tags; `credentialRef` omitido; `includeSecrets: false` por padrão.
2. **Import** — validação Zod na fronteira; merge por nome (case-insensitive); relatório `{ created, skipped, errors }`.
3. Diálogos nativos `showSaveDialog` / `showOpenDialog` no main (`inventory:export|import`).
4. **electron-builder** — appId `app.north.desktop`, DMG/NSIS/AppImage+deb, `npmRebuild: true` para nativos (`better-sqlite3`, `serialport`).
5. **electron-updater** — publish GitHub Releases; checagem opt-in (`updates:check`); notificação discreta `updates:available`; install sob demanda.

## Consequências

- Segredos nunca viajam no JSON de inventário do MVP.
- Auto-update desligado em dev salvo `NORTH_ENABLE_UPDATES`.
