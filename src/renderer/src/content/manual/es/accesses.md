# Accesos

Los accesos guardan credenciales **sin** abrir sesión remota:

- **Login** — usuario/contraseña y URL opcional (portal, panel)
- **Base de datos** — motor, host, puerto, database, SSL
- **Otro** — secreto genérico con notas

## Acciones en el panel

- **Revelar / ocultar contraseña** — muestra el secreto solo cuando lo pides
- **Copiar contraseña** — para pegar en el destino
- **Copiar connection string** — útil en accesos de base de datos
- **Abrir URL** — abre el enlace en el navegador del sistema

Las contraseñas quedan en el vault del main. El renderer solo recibe el valor en claro en el momento del reveal consciente.
