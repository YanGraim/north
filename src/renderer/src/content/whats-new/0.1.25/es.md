## Agentes

- **Gestor de agentes de IA:** nueva sección "Agentes" en la barra lateral y un board Kanban con columnas 100% personalizables (crea, renombra y elimina columnas) para correr Claude Code, Codex o cualquier CLI de agente en una git worktree aislada, sin tocar el repo principal
- **Contexto siempre visible:** la sesión de un agente muestra el repositorio, la branch y la tarea anotada en una barra arriba de la terminal — fácil saber qué agente es cuál con varias pestañas abiertas
- Crear un workspace corre `git worktree add` automáticamente; eliminar corre `git worktree remove` sin `--force` — si hay cambios sin confirmar, no se pierde nada

Ver el capítulo [Agentes](agents) en el manual.
