## Agente SSH en Windows

- **Reenviar agente SSH:** en Windows, North ahora encuentra de forma fiable el servicio OpenSSH Authentication Agent. Antes, en algunas máquinas el reenvío no funcionaba y `git` en el servidor daba *Permission denied*
- **Aviso en la terminal:** si no se puede activar el reenvío (ningún agente en ejecución o el servidor lo rechaza), North lo indica en amarillo, como `ssh -A`

Consulta el capítulo [Conectar](connect) del manual.
