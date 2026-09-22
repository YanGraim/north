## Terminal

- **Pegar imagen:** pegá una imagen del portapapeles (ej.: un screenshot) directo en la terminal — North la guarda en un archivo temporal y pega la ruta, igual que hacen iTerm2/Terminal.app. Útil para CLIs de agente como Claude Code.
- **Terminal local en la barra lateral:** ahora es uno de los primeros ítems en Visión general, no solo en la Command Palette

## Agentes

- **Aviso de branch en uso:** al crear un workspace con una branch que ya está abierta en otro lugar (incluida la carpeta principal del repositorio), North avisa y muestra dónde, en vez de solo fallar después del intento

Ver los capítulos [Conectar](connect) y [Agentes](agents) en el manual.

## Cliente API

- **Comentarios en JSON:** el body JSON ahora acepta `//` y `/* */` — North los quita antes de enviar, así que la API de destino siempre recibe JSON válido
- **Notas en la request:** nueva pestaña **Notas** para documentar qué hace una request, visible como tooltip en el árbol de Collections

Ver el capítulo [Cliente API](api) en el manual.

## Monitoreo

- **Monitoreo de disponibilidad:** activa un checkeo periódico para cualquier Connection (¿el puerto responde?) — bolita de estado, historial de caídas y notificación nativa cuando algo cae o vuelve. Opt-in por conexión, sin métricas, sin agente instalado en el servidor.
- **Widget en el Dashboard:** mirá todo lo que está caído ahora y cuántas caídas hoy/esta semana, en un solo lugar

Ver el capítulo [Conectar](connect) en el manual.
