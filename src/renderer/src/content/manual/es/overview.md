# Resumen

**North** es un workspace de escritorio para infraestructura — no solo un launcher de SSH.

Organiza clientes, entornos, conexiones remotas y accesos (credenciales de base de datos o login de portal) en un solo lugar. Las sesiones remotas corren **dentro de la app**: terminal, escritorio y transferencia de archivos integrados.

## Qué obtienes

- Jerarquía clara: Cliente → Entorno → Grupo → ítems
- Sesiones in-app sin depender de clientes externos
- Credenciales en el vault local (`safeStorage` / keychain del SO)
- Workflows del grupo para acciones repetibles (deploy, restart, health-check)
- Command Palette y atajos para ir del inventario a la sesión en segundos
- Perfil local (nombre y correo opcional) en **Ajustes** — solo en este equipo, visible en el chip de la barra lateral
- Fuente de la app (familia y tamaño) en **Ajustes → Fuente de la app** — se aplica a toda la interfaz, terminal, editores de código, hosts/puertos y atajos

## Workspaces

El botón en la esquina superior derecha, junto a VPN, muestra en qué workspace estás. **Mi workspace** queda en este equipo, en la base local y en el vault del sistema. Con el **+** junto a **Organizaciones**, escribe la dirección del North Server de tu empresa e inicia sesión con tu correo (el inicio corporativo con Entra ID llega pronto). En una organización, clientes, entornos, grupos, conexiones y etiquetas viven en el servidor y se comparten con el equipo; los favoritos son solo tuyos. Nada se sincroniza entre workspaces. Ya puedes conectarte desde la organización. La contraseña de cada conexión se guarda cifrada en el servidor, y North la busca solo al abrir la sesión, sin guardar copia en este equipo. Cada vez que se lee una contraseña (para conectar o pegarla en la terminal), el servidor registra quién la leyó y para qué. En una organización, cada persona ve solo los proyectos (cliente, entorno o grupo) que un admin le asignó, con uno de tres roles: **Admin** hace todo y crea clientes; **Editor** crea, edita y elimina lo que hay dentro del proyecto; **Lector** ve y se conecta, pero no edita ni revela o pega la contraseña. Los botones que no puedes usar no aparecen. Si el árbol está vacío, pide acceso a un admin de la organización. Las claves privadas y las VPN siguen siendo de cada equipo. Accesos, workflows y APIs dentro de una organización llegan en las próximas versiones. Para salir, abre el selector y elige **Salir de esta organización**.
