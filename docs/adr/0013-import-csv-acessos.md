# ADR 0013 — Import CSV e Accesses no inventário

- **Status:** Aceito
- **Data:** 2026-07-25

## Contexto

O inventário JSON v1 cobria só conexões. A fonte real de muitos usuários é uma planilha (servidores, bancos, logins). Accesses existiam no app mas ficavam de fora do backup.

## Decisão

1. **CSV UTF-8** dedicado (`inventory:import-csv`) com coluna `tipo` = `servidor` | `banco` | `login`. Parser mínimo RFC 4180 + Zod linha a linha. Sem `.xlsx` na v1.
2. **Modelo baixável** — `resources/templates/north-acessos-modelo.csv` + canal `inventory:download-csv-template`.
3. **Senhas no CSV** — só gravadas no vault após confirmação explícita na UI (`allowSecrets: true`).
4. **JSON schemaVersion 2** — grupos incluem `accesses` (sem `credentialRef`). Import aceita v1 e v2; export sempre emite v2.
5. **Relatório** — `ImportReport` ganha contadores `accesses`; erros CSV citam `Linha N: …`.

## Consequências

- Round-trip JSON preserva accesses (ainda sem segredos).
- Planilha entra no mesmo merge hierárquico por nome (case-insensitive).
- Wizard de mapeamento de colunas e `.xlsx` nativo ficam para depois.
