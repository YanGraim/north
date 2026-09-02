# Accesos

Los accesos guardan credenciales en la misma jerarquía Cliente → Ambiente → Grupo:

- **Login** — usuario/contraseña y URL (portal, panel) — **sin** sesión remota
- **Base de datos** — motor, host, puerto, database, SSL. PostgreSQL, MySQL/MariaDB, SQL Server y SQLite abren el [estudio SQL](database); en la UI aparecen con la **marca del motor** (salvo icono personalizado)
- **Otro** — secreto genérico con notas
- **API** — Base URL y cliente HTTP in-app; ver [Cliente API](api)

## Acciones en el panel

- **Conectar** — bancos con motor soportado (estudio SQL) y Access **API** (cliente HTTP)
- **Revelar / ocultar contraseña** — muestra el secreto solo cuando lo pides
- **Copiar contraseña** — para pegar en el destino
- **Copiar connection string** — útil en accesos de base de datos
- **Abrir URL** — abre el enlace en el navegador del sistema

Las contraseñas quedan en el vault del main. El renderer solo recibe el valor en claro en el momento del reveal consciente.
