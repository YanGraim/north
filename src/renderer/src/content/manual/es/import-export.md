# Importar / exportar y actualizaciones

## Inventario en JSON

En **Ajustes → Inventario**:

- **Exportar JSON** — copia del inventario (schemaVersion 2: clientes → entornos → grupos → conexiones **y accesses** + tags)
- **Importar JSON** — restaura desde un JSON exportado (acepta v1 y v2)

El JSON **no incluye credenciales/secretos**. Tras importar, vuelve a configurar contraseñas y claves en el vault.

## Hoja CSV

- **Descargar modelo CSV** — guarda `north-acessos-modelo.csv` para Excel/Sheets
- **Importar hoja (CSV)** — filas con `tipo` = `servidor` | `banco` | `login`

Columnas principales: `cliente`, `ambiente`, `grupo`, `nome`, `protocolo`/`engine`, `host`, `porta`, `database`, `url`, `usuario`, `senha`, `notas`, `tags`.

Si el CSV tiene contraseñas, la UI pide confirmación explícita antes de guardarlas en el vault. Sin confirmación, se ignoran.

## Actualizaciones

En **Ajustes → Actualizaciones**, verifica nuevas versiones vía GitHub Releases (opt-in). En builds de desarrollo el updater suele estar apagado.
