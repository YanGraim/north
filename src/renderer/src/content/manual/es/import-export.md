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

En **Ajustes → Actualizaciones**, verifica nuevas versiones vía GitHub Releases. En builds de desarrollo el updater suele estar apagado.

**macOS — primera instalación:** el `.dmg` no está firmado por Apple; Gatekeeper puede pedir clic derecho → Abrir. Copia North a **Aplicaciones** antes de usar actualizaciones in-app.

**Si vienes de la 0.1.16 o anterior:** instala este `.dmg` **una vez**. Las builds ad-hoc rechazan el zip nuevo. Después, **Verificar ahora** → **Instalar y reiniciar**.

**Actualizaciones siguientes:** el release en GitHub debe estar **publicado** (un borrador/draft no lo ve el updater).
