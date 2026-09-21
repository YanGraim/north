# Cliente API

La sección **APIs** de la barra lateral guarda collections HTTP. No son Connections de servidor. Un Access **API** es solo el entorno (Base URL, auth por defecto, variables). Solo entra en el selector de entorno (y en el botón Conectar) si tiene "Exponer esta URL como variable de entorno" marcado en el registro — sin eso es solo una URL guardada.

## Global vs cliente

- **Globales** — `client_id` vacío, se ven en cualquier lugar.
- **Cliente** — collections de ese cliente, solo se ven ahí.

Un cliente sin collections no aparece. Borrar un Access **no** borra collections. Borrar un cliente borra solo las suyas; las globales permanecen.

**El selector de entorno es independiente de esto.** Lista *todos* los Accesses API con la variable de entorno activada, de cualquier cliente — no hace falta que sea del mismo cliente que la collection abierta. La etiqueta muestra `Cliente / Entorno — nombre` para dejar claro el origen de cada uno.

## Abrir el estudio

Haz clic en una collection de la barra (no hace falta Conectar). **Conectar** en un Access API abre el mismo estudio con ese Access preseleccionado como entorno.

## Importar y exportar

El **+** de la sección, el área vacía y la toolbar del estudio importan **Postman Collection v2.1**. Elige Global o un cliente. Exporta desde el menú contextual. Los secretos salen solo como `{{var}}`.

## Enviar

Una URL absoluta (`https://…`) funciona sin entorno. Una URL relativa necesita un Access API en el selector (Base URL, auth, variables). El selector lista Accesses `type: api` con la variable de entorno activada, de cualquier cliente — no las carpetas HML/PROD del inventario, y no hace falta que coincida con el cliente de la collection.

**Sin entorno** envía solo lo que está en la pestaña. **+ Nuevo entorno** abre el formulario de Access con tipo API (y el cliente de la collection, si hay). Conectar en un Access sigue preseleccionando ese entorno.

Los secretos no salen de main. Sin Access, el envío no entra en el historial.

No hay timeout por defecto. Usa **Cancelar** en la barra de pestañas para abortar. Mientras la request está en curso, el panel de respuesta muestra un spinner y el tiempo transcurrido; la respuesta anterior queda atenuada detrás.

El cuerpo de la respuesta está limitado a 10 MB; por encima de eso se trunca. En ese caso el interruptor Pretty/Raw queda deshabilitado y el aviso al lado muestra "truncado" (en vez de "no es JSON"), con el motivo en el tooltip.

Con body de tipo JSON, el botón **Formatear** (arriba del editor) reindenta el contenido pegado o escrito. El cuerpo de la request y el de la respuesta son editores de código completos — además del botón **Copiar** (copia todo), podés seleccionar cualquier fragmento con el mouse y copiar solo eso (⌘/Ctrl+C).

El body JSON acepta comentarios `//` y `/* */` (JSONC) — útil para dejarte una nota sobre un campo. North quita los comentarios automáticamente antes de enviar (la API de destino recibe JSON válido de verdad); el botón **Formatear** también los quita, ya que el JSON formateado no puede conservar comentarios.

La búsqueda en Collections filtra por nombre, método, URL y carpetas/collections. El Historial filtra por método, URL y estado. Cerrar una pestaña con cambios sin guardar pide guardar, descartar o quedarse.

## Notas de la request

La pestaña **Notas**, en una request, guarda texto libre para documentar qué hace esa request — se muestra como tooltip al pasar el mouse en el árbol de Collections. Separado de la descripción de la collection (que está a nivel de carpeta).

## Variables

Escribe `{{` en la URL, params, headers o en los campos de Auth (Bearer, Basic, API Key) para ver un autocompletado con las variables del entorno seleccionado (más `{{baseUrl}}`, siempre disponible cuando hay entorno). Una `{{variable}}` reconocida aparece resaltada en color de acento; una desconocida aparece subrayada en rojo.

## Presets

**Aplicar preset** y **Guardar como preset…** están en las pestañas Headers y Auth de una request. Un preset guarda un conjunto de headers o una configuración de Auth — nunca ambos — y es global: disponible desde cualquier request, en cualquier collection o cliente, sin depender de un entorno. Guardar Auth como preset sigue la misma convención que el resto de la definición de la request: usa plantillas `{{variable}}` en los campos, nunca secretos literales.

## Atajos

- **⌘/Ctrl+Enter** — Enviar
- **⌘/Ctrl+S** — Guardar request
- **⌘/Ctrl+L** — Enfocar URL
