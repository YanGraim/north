# Accesos

Los accesos guardan credenciales en la misma jerarquía Cliente → Ambiente → Grupo:

- **Login** — usuario/contraseña y URL (portal, panel) — **sin** sesión remota
- **Base de datos** — motor, host, puerto, database, SSL. PostgreSQL, MySQL/MariaDB, SQL Server y SQLite abren el [estudio SQL](database)
- **Otro** — secreto genérico con notas

## Acciones en el panel

- **Conectar** — solo en bancos con motor soportado; abre el editor in-app
- **Revelar / ocultar contraseña** — muestra el secreto solo cuando lo pides
- **Copiar contraseña** — para pegar en el destino
- **Copiar connection string** — útil en accesos de base de datos
- **Abrir URL** — abre el enlace en el navegador del sistema

Las contraseñas quedan en el vault del main. El renderer solo recibe el valor en claro en el momento del reveal consciente.
