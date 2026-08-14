# Workflows

Los **workflows** son acciones repetibles ligadas a un **grupo**: deploy, restart, health-check y similares — sin scripts sueltos fuera de North.

## Dónde crear y editar

1. Selecciona una conexión (o el grupo) en el inventario.
2. Abre el **hub de workflows** del grupo (panel de la conexión o Command Palette → Gestionar workflows…).
3. Crea el workflow: nombre, inputs opcionales y pasos (por ejemplo `ssh.exec`).

Las variables del **grupo** (config en texto plano) valen para todos los workflows de ese grupo. Los inputs se piden en el momento del run.

## Cómo ejecutar

- Panel de la conexión → sección Workflows
- Botón **Conectar** (menú split) → elegir un workflow
- Command Palette → **Ejecutar workflow…** (conexión SSH seleccionada)

La ejecución abre una **pestaña de run** con timeline, progreso y log por paso. Ante un fallo, según la política del paso, puedes **Retry**, **Continue** o **Cancelar**.

## Secretos

Contraseñas y claves viven en la **bolsa de secretos de la conexión**, nunca en la definition del workflow ni en las variables del grupo. North puede pedirlas y ofrecer guardarlas en el vault cuando el paso necesite autenticarse.
