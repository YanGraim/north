## Actualizaciones en Mac

- El auto-update vuelve a usar un certificado **estable** (no ad-hoc). Si estás en la **0.1.16 o anterior**, instala este `.dmg` **una vez**; las versiones siguientes llegan desde la propia app.
- El release en GitHub debe estar **publicado** — los borradores no aparecen en el verificador.
- La primera apertura aún puede pedir clic derecho → Abrir (el certificado no es de Apple).

Ver [Importar / exportar](import-export).

## Sesión y ventana

- **Entorno en la sesión** — la barra y la pestaña muestran **HML** / **PROD** / **DEV** (y el nombre) para no confundir homologación con producción.
- **Titlebar en Windows** — la versión ya no queda bajo los botones minimizar / maximizar / cerrar.
- **El terminal sigue la salida** — el scroll baja solo al final; si subes el historial, no vuelve a saltar.
- **Duración** en el dashboard, el historial y los workflows (`512 ms`, `4m 12s`).

Ver [Conectar](connect).

## Cuadrícula SQL

- **Ejecutar** y ⌘/Ctrl+Enter corren la selección o el statement bajo el cursor (no el buffer entero).
- **Query en páginas de 100** — `SELECT`/`WITH` cargan 100 filas y piden más al hacer scroll, como la pestaña de tabla.
- **Duplicar** inserta la copia justo debajo de la fila; **Definir NULL** en el menú contextual; las columnas `CHAR` respetan la longitud.
- **Redimensionar columnas** — arrastra el borde del encabezado; doble clic ajusta al contenido.
- **Aviso** antes de `UPDATE`/`DELETE` sin `WHERE` en el statement principal.
- **Editar en cualquier resultado** también en SQL Server.

Ver [Estudio SQL](database).
