# VPNs

North guarda las VPNs de tus clientes y activa cada una con un clic, sin abrir FortiClient ni OpenVPN Connect. La VPN vale para todo el sistema, incluido el navegador.

## Registrar

En **VPNs** en la barra lateral, haz clic en **Nueva VPN** o arrastra un archivo `.ovpn` a la pantalla.

- **OpenVPN (.ovpn):** North lee el archivo, muestra el servidor y pide **solo** lo que exige: usuario y contraseña, contraseña de la clave privada o nada. Los archivos que intentan ejecutar scripts (`up`, `down`, `plugin`, `script-security 2`…) se rechazan, con el motivo en pantalla.
- **FortiGate SSL-VPN:** la pestaña "SSL-VPN" de FortiClient. Completa nombre, gateway remoto, puerto, usuario y contraseña; si pegas `ip:puerto` en el gateway, North lo separa. Muchos FortiGates usan certificado propio: en la primera conexión North muestra la huella (SHA-256) y solo conecta después de que hagas clic en **Confiar en este certificado y conectar**. Si el certificado cambia después, bloquea y avisa. En Linux necesita el paquete `ppp` (viene en la mayoría de las distribuciones). Funciona en macOS, Linux y Windows (con OpenConnect, que North incluye).
- **FortiGate / IPsec (IKEv1) e IKEv2:** los campos tienen los mismos nombres y el mismo orden que FortiClient (gateway remoto, clave precompartida, XAuth, usuario). La FortiGate IKEv1 se conecta con strongSwan usando las mismas propuestas de FortiClient (AES, SHA1/SHA256, grupo DH 5), sin perfil que aprobar en Ajustes y, con el componente de VPN instalado, sin pedir contraseña. En Windows, North ejecuta el mismo strongSwan dentro de un pequeño Linux propio en WSL (WSL debe estar activo: `wsl --install`), que solo funciona mientras la VPN está conectada; sirve para VPN de túnel dividido, y sin WSL usa FortiClient para ella. IKEv2 por ahora solo se registra. Si accedes a servidores de la VPN por nombre, completa **Dominios internos** en Editar (ej.: `empresa.local`): solo esos nombres usan el DNS de la VPN, el resto sigue con tu DNS (macOS).
- **VPN de Windows (solo en Windows):** el cliente VPN del propio Windows, como en Configuración → VPN. Completa nombre, dirección del servidor, tipo de VPN (Automático, PPTP, L2TP/IPsec con clave precompartida, SSTP o IKEv2), usuario y contraseña. North crea la conexión en Windows con el nombre "North …" y la enciende y apaga por ti, sin pedir contraseña de administrador; la contraseña va directo a Windows, nunca por línea de comandos. Por defecto solo las redes de la VPN pasan por ella (túnel dividido).

Las contraseñas, la clave precompartida y las claves privadas incluidas en el `.ovpn` van al cofre de North y nunca aparecen en los logs.

## Editar

Arriba de la VPN, **Editar** abre la configuración. En **Conexión** cambias el tipo (SSL-VPN, IPsec o IKEv2), el gateway, el puerto, el usuario, el grupo y el XAuth sin borrar la VPN; las credenciales guardadas siguen valiendo. En una OpenVPN, **Reemplazar archivo .ovpn** cambia el archivo y mantiene nombre, cliente y contraseña. Si cambia el gateway o el puerto, North pide confirmar el certificado de nuevo.

## Activar y apagar

- Desde la píldora **VPN** de la barra superior: cada VPN tiene un switch, con estado, IP y tiempo activa. La píldora se pone verde con una VPN activa, muestra "2 VPNs" con dos, ámbar mientras conecta y roja si una se cae.
- Desde la pantalla **VPNs**: botón **Conectar** / **Apagar** y las pestañas **Resumen**, **Configuración**, **Logs** e **Historial**.

macOS y Linux necesitan permiso de administrador para que la VPN cambie rutas y DNS. En el primer inicio con VPN, North ofrece instalar el **componente de VPN** (como hace FortiClient): el sistema pide la contraseña una sola vez y, a partir de ahí, SSL-VPN, IPsec y OpenVPN se conectan y desconectan sin pedirla. Si lo rechazas, lo ofrece de nuevo en la primera conexión; el botón al final de la lista de VPN lo instala o lo quita. El componente solo puede conectar y desconectar VPN, nada más. Sin él, cada conexión pide la contraseña. Un `.ovpn` con opciones poco comunes (scripts, archivos externos) sigue pidiéndola en cada conexión, por seguridad. En Windows, el componente es el paquete oficial de OpenVPN (sin su interfaz) más un pequeño servicio de North para SSL-VPN: ambos se instalan en la primera conexión, con un único permiso de Windows. North ya incluye openfortivpn, strongSwan y OpenVPN en macOS y Linux: no hay que instalar nada (sus licencias están junto a ellos, en la carpeta `vpn-bin` de la app).

## Desde el ícono de North, sin abrir la ventana

North deja un ícono en la barra de menús (macOS) o en la bandeja junto al reloj (Windows y Linux). Haz clic en él para ver tus VPNs y encender o apagar cualquiera con un clic, como en FortiClient. **Abrir North** trae la ventana de vuelta y **Sair do North** apaga las VPNs y cierra la app.

Con al menos una VPN registrada, cerrar la ventana no cierra North: sigue en el ícono y las VPNs siguen encendidas. Para cerrarlo de verdad, usa **Sair do North** en el ícono (o Cmd+Q en macOS). Abrir North de nuevo desde su acceso directo trae la misma ventana, sin abrir una segunda copia.

## Varias VPNs a la vez

Dos VPNs con redes distintas pueden quedar activas juntas. Si las redes se superponen, o una redirige todo el tráfico, North avisa antes y te deja elegir **Apagar y conectar**, **Conectar de todos modos** o **Cancelar**.

## Cuando algo sale mal

El mensaje dice qué pasó y ofrece la acción correcta: **Actualizar contraseña** cuando el servidor rechaza la credencial, **Reintentar** cuando el servidor no responde o se deniega el permiso de administrador, **Cómo instalar** cuando falta OpenVPN. En **Logs**, **Copiar diagnóstico** copia el log ya sin contraseñas.

## Encender la VPN automáticamente

En **Editar ambiente** (o **Editar cliente**), elige su **VPN**. Desde entonces, abrir una sesión SSH, RDP, de base de datos o API de ese ambiente enciende primero la VPN, espera a que el servidor responda y solo entonces abre la sesión; varias sesiones comparten el mismo túnel, que se apaga solo cuando se cierra la última (si la VPN tiene apagado automático). Vale la VPN del ambiente; sin ella, la del cliente. En cada conexión o acceso, el campo **VPN** ofrece **Heredar** (por defecto), **Nunca usar VPN** u otra VPN. Si la VPN falla, la sesión muestra el error con su nombre. El monitor de conexiones no marca como caído un servidor mientras su VPN está apagada.
