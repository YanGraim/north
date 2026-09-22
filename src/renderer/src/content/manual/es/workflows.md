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

La ejecución abre una **pestaña de run** con timeline, progreso y log por paso. La barra bajo el encabezado muestra el **cliente** y el entorno (**HML** / **PROD** / **DEV** y el nombre). El log del paso sigue la salida; si subes el historial, el follow se pausa hasta volver al final. La duración en el encabezado y en cada paso se congela al terminar. Ante un fallo, según la política del paso, puedes **Retry**, **Continue** o **Cancelar**.

## Secretos

Contraseñas y claves viven en la **bolsa de secretos de la conexión**, nunca en la definition del workflow ni en las variables del grupo. North puede pedirlas y ofrecer guardarlas en el vault cuando el paso necesite autenticarse.

## Inputs (parámetros pedidos antes de ejecutar)

Un workflow puede pedir valores en el momento del run — por ejemplo, qué **tag** desplegar. En el editor, sección **Inputs**, cada input tiene clave, etiqueta, tipo (texto, lista/dropdown, sí-no) y si es obligatorio; en el comando, referencia el valor como `{{clave}}`.

Para un input de tipo lista, las opciones pueden venir de dos orígenes:

- **Opciones fijas**: una lista escrita manualmente (`etiqueta=valor` por línea).
- **Tags de Git (en vivo)**: en vez de escribir las tags, North ejecuta `git fetch --tags` en la ruta del repositorio indicada (por la misma conexión SSH) y arma el dropdown con las tags reales del servidor en el momento de ejecutar — sin riesgo de escribir la tag equivocada.

El botón **Deploy por tag (Git)**, junto a "Adicionar input", crea de una vez un input listo para ese caso más común (clave `tag`, obligatorio, origen = Tags de Git, ruta pre-rellenada desde el Rastreo Git si ya está configurado abajo).

## Rastreo Git (opcional)

Un workflow puede activar el **rastreo Git**: actívalo en el editor e indica la ruta de un repositorio en el servidor (ej.: `/var/www/html/wms-api`), y North captura el commit actual antes de ejecutar y otra vez después. Si el commit cambió, registra automáticamente qué commits entraron, cuántos archivos se modificaron y si la ejecución tuvo éxito o falló — sin cambiar en nada lo que hace el workflow.

Esto no requiere API de proveedor Git (GitHub/Bitbucket) ni PRs — North lee el estado directamente del repositorio en el servidor, usando los mismos comandos SSH que el workflow ya usa. Si la ruta no existe o no es un repositorio Git, el rastreo simplemente no registra nada; el workflow sigue funcionando con normalidad.

El historial de actualizaciones aparece en dos lugares:

- **Dashboard** → sección **Últimas actualizaciones**, al final — vista global, cruzando todos los clientes/entornos: cuántas actualizaciones hoy/esta semana, un gráfico por semana y la línea de tiempo completa.
- **Panel de la conexión** → sección **Actualizaciones**, justo debajo de Workflows — la misma vista, filtrada solo al entorno de esa conexión.

En ambos casos, el historial es por **entorno**: si dos conexiones distintas (ej.: backend y frontend) actualizan el mismo entorno vía workflows separados, todo aparece junto.
