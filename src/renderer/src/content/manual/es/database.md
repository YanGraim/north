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
- grid en **Resultados** a 13px: clic en el **nombre** del encabezado selecciona la columna entera (Shift / ⌘/Ctrl para intervalo o alternar); arrastra las **celdas** (arriba/abajo o un rectángulo) para solo algunos valores; el **icono** cicla la ordenación; arrastra el encabezado para reordenar. El clic en la tabla carga al instante (**100 filas** por página) y pide más al hacer scroll (el pie muestra `100+`, luego el total exacto al llegar al final). La query libre sigue con tope de 1000 filas
- clic en `#` para seleccionar filas (Shift / ⌘/Ctrl / arrastre); ⌘/Ctrl+C copia TSV — filas (todas las columnas visibles), una columna entera, o solo las celdas del intervalo
- con columna(s) o un intervalo de celdas seleccionados, **Suma** en el pie totaliza los números visibles al momento (omite NULL y texto no numérico; incluye `numeric`/`decimal`/`bigint` y edición pendiente). Clic en el total para copiar; queda junto al recuento de filas hasta que cambies la selección
- interruptor **Cuadrícula | Registro** en el panel de resultados: Registro muestra la fila seleccionada (o la primera) como campo | valor (texto seleccionable), con flechas para navegar; doble clic, F2 o Enter edita el campo
- en cualquier result set (tabla, query libre, JOIN o view), doble clic, **F2** o **Enter** abre el editor de la celda; un clic simple sigue seleccionando la fila. Insertar / Duplicar / Eliminar (clic derecho) solo en la pestaña de **tabla** que no es view
- **Guardar** / **Cancelar** aparecen en el pie en cuanto cambia el valor (⌘/Ctrl+S guarda). Guardar ejecuta un `UPDATE` de verdad: en la pestaña de tabla, sobre esa relación; en la query libre, sobre la primera tabla del `FROM` (con JOIN, no las tablas del JOIN). Hace falta clave primaria en el result set; `DISTINCT` / `GROUP BY` / `UNION` / `WITH` no se pueden guardar (el resultado no mapea 1:1). El auto-commit de la sesión sigue aplicando
- en la barra de sesión: interruptor **Auto-commit** (activado por defecto), **Commit** y **Rollback** — a nivel de sesión, no por pestaña. Con auto-commit activo, cada statement (y Guardar del grid) persiste al momento; desactivado, la siguiente query/mutación abre una transacción en el servidor hasta Commit o Rollback. Reactivar el auto-commit con transacción abierta queda bloqueado. Es distinto del Guardar/Cancelar del pie (que arma el `UPDATE`/`INSERT`/`DELETE` a partir de las ediciones de la cuadrícula)
- cabecera de sesión igual a SSH: `usuario@host`, carpeta del entorno y tinte HML/PROD cuando el entorno tiene contexto
- pie con filas y tiempo; la pestaña **Mensajes** solo aparece si la query falla (error completo del banco)

La contraseña **no** llega a la UI de la sesión — el main la resuelve en el vault.

## Límites de esta versión

- Sin túnel SSH por la Connection del grupo — el host debe ser alcanzable desde tu máquina
- Sin export CSV; tablas sin clave primaria no se pueden guardar desde el grid
- Las queries tienen timeout de 30s; INSERT/UPDATE/DELETE libres siguen disponibles como SQL
