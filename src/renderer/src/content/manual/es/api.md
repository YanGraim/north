# Cliente API

La sección **APIs** de la barra lateral guarda collections HTTP. No son Connections de servidor. Un Access **API** es solo el entorno (Base URL, auth por defecto, variables).

## Global vs cliente

- **Globales** — `client_id` vacío. El selector de entorno lista todos los Accesses API.
- **Cliente** — collections de ese cliente; el selector lista solo sus Accesses API, con etiqueta `HML — teste`.

Un cliente sin collections no aparece. Borrar un Access **no** borra collections. Borrar un cliente borra solo las suyas; las globales permanecen.

## Abrir el estudio

Haz clic en una collection de la barra (no hace falta Conectar). **Conectar** en un Access API abre el mismo estudio con ese Access preseleccionado como entorno.

## Importar y exportar

El **+** de la sección, el área vacía y la toolbar del estudio importan **Postman Collection v2.1**. Elige Global o un cliente. Exporta desde el menú contextual. Los secretos salen solo como `{{var}}`.

## Enviar

Elige un entorno antes de Enviar. URL, auth por defecto y variables vienen del Access seleccionado (`accesses.url` es `{{baseUrl}}`). Los secretos no salen de main.

No hay timeout por defecto. Usa **Cancelar** en la barra de pestañas para abortar. Mientras la request está en curso, el panel de respuesta muestra un spinner y el tiempo transcurrido; la respuesta anterior queda atenuada detrás.

La búsqueda en Collections filtra por nombre, método, URL y carpetas/collections. El Historial filtra por método, URL y estado. Cerrar una pestaña con cambios sin guardar pide guardar, descartar o quedarse.

## Atajos

- **⌘/Ctrl+Enter** — Enviar
- **⌘/Ctrl+S** — Guardar request
- **⌘/Ctrl+L** — Enfocar URL
