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

- La barra superior muestra `usuario@host`, la carpeta del **entorno** y el badge **HML** / **PROD** / **DEV** cuando el nombre tiene contexto — la pestaña también lleva la etiqueta corta, junto con el nombre del **cliente**, para distinguir pestañas del mismo entorno entre clientes diferentes.
- El terminal sigue la salida mientras estás al final; si subes el historial, no vuelve a saltar.
- Haz clic en la línea de comando actual para colocar el cursor (sin usar las flechas). Arrastrar sigue seleccionando texto.
- **⌘A** (macOS) o **Ctrl+A** (Windows/Linux) selecciona el texto escrito en la línea (no el prompt); pulsa otra vez para seleccionar todo el historial. Con la selección activa, **Backspace** / **Delete** borra ese texto; **⌘X** / **Ctrl+X** corta (copia y borra). En Mac, **Ctrl+A** sigue yendo al shell (inicio de línea).
- El menú contextual (clic derecho) tiene **Pegar contraseña guardada** cuando la conexión tiene una contraseña o contraseña de sudo guardada — pega el secreto guardado en el vault directo en la terminal (útil para `sudo su` y similares), sin pasar nunca por el portapapeles del sistema.
- Pegar una imagen (⌘V/Ctrl+V con una imagen copiada, por ejemplo un screenshot) la guarda en un archivo temporal y pega la ruta como texto — igual que hacen iTerm2/Terminal.app. Útil para mandar una imagen a CLIs de agente (Claude Code y similares) corriendo en la terminal.

## Terminal local

**Terminal local**, arriba en la barra lateral (Visión general) o por la Command Palette (**⌘/Ctrl+K**), abre el shell de tu propia máquina — sin host, sin credencial, sin Connection guardada. Corre en el proceso main, igual que las demás sesiones de terminal; cerrar la pestaña termina el proceso del shell.

## Favoritos y pestañas

- Marca conexiones como favoritas para acceso rápido.
- Varias pestañas pueden quedar abiertas; cierra con el atajo de cerrar pestaña.
- Duplicar pestaña reabre la misma conexión en paralelo.
