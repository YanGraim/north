# Agentes

La sección **Agentes** de la barra lateral gestiona workspaces de agentes de IA (Claude Code, Codex, o cualquier CLI) corriendo en git worktrees aisladas — no forma parte de la jerarquía Cliente → Entorno → Grupo → Conexión.

## Crear un workspace

**Nuevo workspace** (en la barra lateral o en el board) pide:

- **Repositorio** — cualquier carpeta con un repositorio git, elegida con el selector nativo. No necesita estar registrada en North.
- **Branch** — nombre de la nueva branch que se creará para la worktree.
- **Comando del agente** — texto libre (`claude`, `codex`, lo que sea).
- **Tarea** (opcional) — una nota corta sobre qué está haciendo el agente.

Al crear, North corre `git worktree add` dentro del repositorio, creando la carpeta en `<repositorio>/.north/worktrees/<branch>`. La sesión se abre automáticamente corriendo el comando del agente ahí dentro. Si la branch que escribiste ya existe, North avisa antes de crear: si está libre, ofrece usar esa branch existente (checkout); si ya está abierta en otra worktree (incluida la carpeta principal del repositorio), bloquea y muestra dónde — git no permite la misma branch en dos lugares a la vez.

## Sesión y contexto

La sesión de un workspace es una terminal como cualquier otra (misma pestaña, mismo motor), pero con una barra de contexto arriba de la terminal mostrando el **repositorio**, la **branch** y la **tarea** anotada — para no perder de vista qué agente/branch está abierto cuando hay varias sesiones en paralelo.

## Board (Kanban)

El board nace con 3 columnas (**Backlog**, **En progreso**, **Completado**), pero son totalmente tuyas:

- **+ Nueva columna** crea una columna con el nombre que quieras.
- Haz clic en el nombre de una columna para renombrarla.
- Pasa el mouse por el encabezado de la columna para ver el botón de eliminar — eliminar una columna no borra sus workspaces, solo quedan en "Sin columna" hasta que los muevas.
- Arrastra las cards entre columnas libremente.

Un punto verde en la card indica que hay una sesión abierta ahora para ese workspace; gris indica que no hay.

## Eliminar un workspace

Eliminar corre `git worktree remove` **sin `--force`**. Si la worktree tiene cambios sin confirmar, la eliminación falla y no se pierde nada — confirma o descarta los cambios manualmente antes de intentar de nuevo.
