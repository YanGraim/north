# Conectar

Para abrir una sesión:

1. Selecciona una **conexión** en la lista.
2. Usa **Conectar** (o Enter en la Command Palette).
3. La sesión abre en una **pestaña** del workspace — terminal, escritorio, archivos o **estudio SQL**, según el tipo.

Las bases registradas como Access (PostgreSQL, MySQL/MariaDB, SQL Server, SQLite) también tienen **Conectar**. Detalles en el capítulo **Estudio SQL**.

## Workflows (SSH)

En el botón **Conectar**, el menú split también lista workflows del grupo. Puedes abrir la sesión interactiva o disparar un workflow sin salir del inventario. Detalles en el capítulo **Workflows**.

## Host key (SSH)

En la primera conexión SSH, North pide confirmar la clave del host. Acepta solo si el fingerprint coincide con lo esperado.

## Terminal

En una pestaña de sesión terminal:

- Haz clic en la línea de comando actual para colocar el cursor (sin usar las flechas). Arrastrar sigue seleccionando texto.
- **⌘A** (macOS) o **Ctrl+A** (Windows/Linux) selecciona el texto escrito en la línea (no el prompt); pulsa otra vez para seleccionar todo el historial. Con la selección activa, **Backspace** / **Delete** borra ese texto; **⌘X** / **Ctrl+X** corta (copia y borra). En Mac, **Ctrl+A** sigue yendo al shell (inicio de línea).

## Favoritos y pestañas

- Marca conexiones como favoritas para acceso rápido.
- Varias pestañas pueden quedar abiertas; cierra con el atajo de cerrar pestaña.
- Duplicar pestaña reabre la misma conexión en paralelo.
