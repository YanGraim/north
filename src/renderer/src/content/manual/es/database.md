# Estudio SQL

Los accesos de **base de datos** con PostgreSQL, MySQL/MariaDB, SQL Server o SQLite abren una sesión in-app — sin DBeaver o Beekeeper aparte.

## Registrar

**Nueva conexión → Base de datos** en el dashboard, **Nuevo → Banco** en la lista, o **Nueva base** en el grupo abre el modal: motor, host, puerto, database, usuario, contraseña y SSL al final. SQLite pide el archivo local.

- **Probar conexión** valida el acceso sin abrir el editor
- **Guardar y conectar** guarda el Access y abre el estudio al momento

Redis, MongoDB y “otro” siguen siendo solo inventario (copiar string / revelar contraseña).

## Conectar

En el panel del banco, **Conectar** abre una pestaña con:

- árbol de schemas y tablas — el clic abre una pestaña de datos (`tabla [all]`), no pega SQL en el editor
- barra de filtro en la pestaña de la tabla: `WHERE` corto o una query completa; autocomplete solo de columnas de la tabla y keywords de filtro (`AND`/`NOT`/`NULL`…); **Enter** aplica (**Ejecutar** está a la derecha de la barra de pestañas)
- pestañas estilo Beekeeper: varias tablas y **Query #n** (el **+** abre un editor SQL; ⌘/Ctrl+Enter o **Ejecutar** en la barra de pestañas ejecuta la selección o el buffer)
- **Formatear** en la barra de pestañas (⌘/Ctrl+Shift+F, como en DBeaver) organiza el SQL de la pestaña de query — la selección, si hay; si no, el buffer entero
- autocomplete de tablas/columnas en el editor (Ctrl/⌘+Space): filtra por prefijo y por fragmento del nombre (`users` encuentra `log_users` y `users_companies`); el popup muestra el alias sugerido y el tipo (`Table`) con colores; al aceptar (o Tab en el nombre), inserta el alias (`balances` → `balances b`)
- grid en **Resultados** con ordenación al clic en el encabezado y arrastre para reordenar columnas; el clic en la tabla carga al instante (**100 filas** por página) y pide más al hacer scroll (el pie muestra `100+`, luego el total exacto al llegar al final). La query libre sigue con tope de 1000 filas
- clic en la fila para seleccionar (Shift / ⌘/Ctrl para extender); ⌘/Ctrl+C copia las filas seleccionadas en TSV
- interruptor **Cuadrícula | Registro** en el panel de resultados: Registro muestra la fila seleccionada (o la primera) como campo | valor (texto seleccionable), con flechas para navegar; doble clic o Enter edita el campo
- en la pestaña de **tabla** (no vista ni query libre), doble clic edita la celda (cuadrícula o registro); clic derecho en la fila para **Insertar**, **Duplicar** o **Eliminar** (pendiente hasta guardar)
- **Guardar** / **Cancelar** aparecen en el pie de resultados en cuanto cambia el valor (⌘/Ctrl+S guarda); escriben `UPDATE` / `INSERT` / `DELETE` cuando la tabla tiene clave primaria
- en la barra de sesión: interruptor **Auto-commit** (activado por defecto), **Commit** y **Rollback** — a nivel de sesión, no por pestaña. Con auto-commit activo, cada statement (y Guardar del grid) persiste al momento; desactivado, la siguiente query/mutación abre una transacción en el servidor hasta Commit o Rollback. Reactivar el auto-commit con transacción abierta queda bloqueado. Es distinto del Guardar/Cancelar del pie (que solo aplica INSERT/UPDATE/DELETE locales)
- cabecera de sesión igual a SSH: `usuario@host`, carpeta del entorno y tinte HML/PROD cuando el entorno tiene contexto
- pie con filas y tiempo; la pestaña **Mensajes** solo aparece si la query falla (error completo del banco)

La contraseña **no** llega a la UI de la sesión — el main la resuelve en el vault.

## Límites de esta versión

- Sin túnel SSH por la Connection del grupo — el host debe ser alcanzable desde tu máquina
- Sin export CSV; tablas sin clave primaria no se pueden guardar desde el grid
- Las queries tienen timeout de 30s; INSERT/UPDATE/DELETE libres siguen disponibles como SQL
