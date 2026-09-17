## Cliente API

- **Enviar sin entorno:** una URL absoluta (`https://…`) funciona sin Access API. El selector incluye **Sin entorno** y **+ Nuevo entorno** para crear un Access de tipo API
- **Entorno/variable es opt-in:** un Access de tipo API solo se vuelve entorno (y gana `{{baseUrl}}` automático) cuando marcas "Exponer esta URL como variable de entorno" en el registro — sin marcar, es solo una URL guardada, sin botón Conectar
- **Los entornos son globales:** el selector de entorno lista Accesses API de cualquier cliente, no solo del cliente de la collection abierta
- **Autocompletado de variables:** escribe `{{` en la URL, params, headers o Auth para ver las variables del entorno seleccionado; una `{{variable}}` reconocida se resalta, una desconocida aparece subrayada en rojo
- **Presets reutilizables:** guarda un conjunto de headers o una configuración de Auth como preset global desde las pestañas Headers/Auth y aplícalo después en cualquier request, de cualquier collection
- **Filas de headers/params más limpias y lista de Variables rediseñada**, con botón para revelar secretos guardados
- **Respuestas grandes:** el límite del cuerpo de respuesta subió de 1 MB a 10 MB, y la vista de respuesta JSON quedó más legible (más espaciado, resaltado de sintaxis); cuando el cuerpo se trunca, el aviso ahora lo dice explícitamente en vez de decir "no es JSON"

Ver el capítulo [Cliente API](api) en el manual.

## Personalización

- **Fuente de la app:** elige la familia (IBM Plex Mono, JetBrains Mono, monoespaciada del sistema, Menlo/Consolas, Courier New) y el tamaño en **Ajustes → Fuente de la app** — se aplica a todo: la interfaz, la terminal, los editores de código, hosts/puertos y atajos

## Correcciones

- La búsqueda (🔍) en la respuesta del Cliente API ahora resalta y navega hasta los resultados — antes el campo existía pero no hacía nada
- Expandir una carpeta dentro de una Collection ya no colapsa las demás carpetas abiertas
