# Organización

El inventario sigue una jerarquía explícita:

1. **Cliente** — empresa o cuenta que atiendes
2. **Entorno** — producción, staging, lab, etc.
3. **Grupo** — agrupación lógica (región, stack, equipo)
4. **Ítems** — conexiones y accesos dentro del grupo

## Conexiones vs accesos

| Tipo | Para qué |
| --- | --- |
| **Conexión** | Servidor remoto con sesión (SSH, RDP, VNC, SFTP, FTP, Telnet, Serial) |
| **Acceso** | Credencial de base de datos, login de portal u otro secreto — **sin** sesión remota |

Piensa en conexiones como “cómo llego al host” y accesos como “qué uso para autenticarme en servicios”.

## Workflows

El **grupo** es el dueño de los workflows y de las variables de proyecto. La ejecución apunta a una conexión; las credenciales nunca viven en el workflow — solo en la bolsa de secretos de la conexión.
