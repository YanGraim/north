## Estudio SQL

Conecta a PostgreSQL, MySQL/MariaDB, SQL Server y SQLite desde un Access de base de datos.

- Modal de conexión con host, puerto, usuario, contraseña y **Probar**
- **Conectar** abre el estudio: árbol, pestañas de tabla/query, barra de filtro y grid con ordenación y columnas arrastrables
- **Ejecutar** en la barra de pestañas; pie con filas/tiempo (`100+` mientras queden más páginas en la pestaña de tabla); **Mensajes** solo cuando la query falla
- Autocomplete SQL con alias al aceptar tabla (Tab también expande `balances` → `balances b`); popup con colores (tabla / alias / tipo) y filtro por fragmento del nombre
- Selecciona filas en el grid (Shift / ⌘/Ctrl), copia en TSV; edita celdas en pestañas de tabla — **Guardar** / **Cancelar** aparecen en el pie en cuanto cambia el valor (⌘/Ctrl+S)
- Clic derecho en la fila para insertar, duplicar o marcar borrado; la vista Registro permite seleccionar y editar valores
- Cabecera de sesión con `usuario@host` y entorno (tinte HML/PROD), como en SSH
- El clic en la tabla carga al instante; las pestañas de tabla piden más filas al hacer scroll (páginas de 100)
- **Auto-commit**, **Commit** y **Rollback** en la barra de sesión (transacción en el servidor; distinto del Guardar del grid)
- **Formatear** SQL en la pestaña de query (⌘/Ctrl+Shift+F)
