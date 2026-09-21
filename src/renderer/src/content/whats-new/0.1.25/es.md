## Agentes

- **Gestor de agentes de IA:** nueva sección "Agentes" en la barra lateral y un board Kanban con columnas 100% personalizables (crea, renombra y elimina columnas) para correr Claude Code, Codex o cualquier CLI de agente en una git worktree aislada, sin tocar el repo principal
- **Contexto siempre visible:** la sesión de un agente muestra el repositorio, la branch y la tarea anotada en una barra arriba de la terminal — fácil saber qué agente es cuál con varias pestañas abiertas
- Crear un workspace corre `git worktree add` automáticamente; eliminar corre `git worktree remove` sin `--force` — si hay cambios sin confirmar, no se pierde nada

Ver el capítulo [Agentes](agents) en el manual.

## Workflows

- **Rastreo Git en workflows:** activa el rastreo en un workflow (ruta del repositorio en el servidor) y North registra automáticamente, en cada ejecución, qué commits entraron, cuántos archivos cambiaron y si tuvo éxito o falló — sin cambiar en nada lo que hace el workflow
- **Historial de actualizaciones por entorno:** widget "Últimas actualizaciones" en el Dashboard (vista global, todos los clientes/entornos) más una versión filtrada en el panel de cada conexión — cuántas actualizaciones hoy/esta semana, un gráfico por semana y una línea de tiempo expandible con los commits de cada una

Ver el capítulo [Workflows](workflows) en el manual.
