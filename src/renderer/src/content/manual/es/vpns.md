# VPNs

North guarda las VPNs de tus clientes y activa cada una con un clic, sin abrir FortiClient ni OpenVPN Connect. La VPN vale para todo el sistema, incluido el navegador.

## Registrar

En **VPNs** en la barra lateral, haz clic en **Nueva VPN** o arrastra un archivo `.ovpn` a la pantalla.

- **OpenVPN (.ovpn):** North lee el archivo, muestra el servidor y pide **solo** lo que exige: usuario y contraseña, contraseña de la clave privada o nada. Los archivos que intentan ejecutar scripts (`up`, `down`, `plugin`, `script-security 2`…) se rechazan, con el motivo en pantalla. Los servidores OpenVPN en MikroTik (RouterOS) suelen cortar la conexión justo después del inicio de sesión con OpenVPN 2.6. Cuando el certificado del `.ovpn` fue generado por RouterOS, North agrega solo `tls-version-max 1.2`, `data-ciphers` con el cifrado del archivo y `tls-cipher DEFAULT:@SECLEVEL=0`; lo que el archivo ya define sigue valiendo.
- **FortiGate SSL-VPN:** la pestaña "SSL-VPN" de FortiClient. Completa nombre, gateway remoto, puerto, usuario y contraseña; si pegas `ip:puerto` en el gateway, North lo separa. Muchos FortiGates usan certificado propio: en la primera conexión North muestra la huella (SHA-256) y solo conecta después de que hagas clic en **Confiar en este certificado y conectar**. Si el certificado cambia después, bloquea y avisa. En Linux necesita el paquete `ppp` (viene en la mayoría de las distribuciones). Funciona en macOS, Linux y Windows (con OpenConnect, que North incluye).
- **FortiGate / IPsec (IKEv1) e IKEv2:** los campos tienen los mismos nombres y el mismo orden que FortiClient (gateway remoto, clave precompartida, XAuth, usuario). La FortiGate IKEv1 se conecta con strongSwan usando las mismas propuestas de FortiClient (AES, SHA1/SHA256, grupo DH 5), sin perfil que aprobar en Ajustes y, con el componente de VPN instalado, sin pedir contraseña. En Windows, North ejecuta el mismo strongSwan dentro de un pequeño Linux propio en WSL (WSL debe estar activo: `wsl --install`), que solo funciona mientras la VPN está conectada; sirve para VPN de túnel dividido, y sin WSL usa FortiClient para ella. IKEv2 por ahora solo se registra. Si accedes a servidores de la VPN por nombre, completa **Dominios internos** en Editar (ej.: `empresa.local`): solo esos nombres usan el DNS de la VPN, el resto sigue con tu DNS (macOS).
- **VPN de Windows (solo en Windows):** el cliente VPN del propio Windows, como en Configuración → VPN. Completa nombre, dirección del servidor, tipo de VPN (Automático, PPTP, L2TP/IPsec con clave precompartida, SSTP o IKEv2), usuario y contraseña. North crea la conexión en Windows con el nombre "North …" y la enciende y apaga por ti, sin pedir contraseña de administrador; la contraseña va directo a Windows, nunca por línea de comandos. Por defecto solo las redes de la VPN pasan por ella (túnel dividido).

Las contraseñas, la clave precompartida y las claves privadas incluidas en el `.ovpn` van al cofre de North y nunca aparecen en los logs.

## Editar

Arriba de la VPN, **Editar** abre la configuración. En **Conexión** cambias el tipo (SSL-VPN, IPsec o IKEv2), el gateway, el puerto, el usuario, el grupo y el XAuth sin borrar la VPN; las credenciales guardadas siguen valiendo. En una OpenVPN, **Reemplazar archivo .ovpn** cambia el archivo y mantiene nombre, cliente y contraseña. Si cambia el gateway o el puerto, North pide confirmar el certificado de nuevo.

## Activar y apagar

- Desde la píldora **VPN** de la barra superior: cada VPN tiene un switch, con estado, IP y tiempo activa. La píldora se pone verde con una VPN activa, muestra "2 VPNs" con dos, ámbar mientras conecta y roja si una se cae.
- Desde la pantalla **VPNs**: botón **Conectar** / **Apagar** y las pestañas **Resumen**, **Configuración**, **Logs** e **Historial**.

macOS y Linux necesitan permiso de administrador para que la VPN cambie rutas y DNS. En el primer inicio con VPN, North ofrece instalar el **componente de VPN** (como hace FortiClient): el sistema pide la contraseña una sola vez y, a partir de ahí, SSL-VPN, IPsec y OpenVPN se conectan y desconectan sin pedirla. Si lo rechazas, lo ofrece de nuevo en la primera conexión; el botón al final de la lista de VPN lo instala o lo quita. El bloque muestra si está instalado, ausente o desactualizado. Si instalarlo o quitarlo falla, el mensaje dice qué pasó y qué hacer, sin la línea técnica del instalador. El componente solo puede conectar y desconectar VPN, nada más. Sin él, cada conexión pide la contraseña. Un `.ovpn` con opciones poco comunes (scripts, archivos externos) sigue pidiéndola en cada conexión, por seguridad. En Windows, el componente es el paquete oficial de OpenVPN (sin su interfaz) más un pequeño servicio de North para SSL-VPN: ambos se instalan en la primera conexión, con un único permiso de Windows. El pequeño Linux de WSL que usa IPsec solo se crea en la primera conexión IPsec, y **Quitar componente de VPN** lo borra también. North ya incluye openfortivpn, strongSwan y OpenVPN en macOS y Linux: no hay que instalar nada (sus licencias están junto a ellos, en la carpeta `vpn-bin` de la app).

## Desde el ícono de North, sin abrir la ventana

North deja un ícono en la barra de menús (macOS) o en la bandeja junto al reloj (Windows y Linux). Haz clic en él para ver tus VPNs y encender o apagar cualquiera con un clic, como en FortiClient. **Abrir North** trae la ventana de vuelta y **Sair do North** apaga las VPNs y cierra la app.

Con alguna VPN conectada, la N gana una elipse verde en la esquina inferior derecha. Varias VPNs en línea siguen con una sola elipse; los nombres siguen en el texto al pasar el mouse. Conectando, reconectando, con error o apagada, el ícono vuelve a ser solo la N.

Cerrar la ventana deja North en el ícono. Con una VPN registrada, eso no se puede desactivar en Configuración, y las VPNs siguen encendidas. Sin VPN, **Cerrar a la bandeja** en Configuración → Inicio controla el botón de cerrar. Para salir de verdad, usa **Sair do North** en el ícono (o Cmd+Q en macOS). Abrir North de nuevo desde su acceso directo trae la misma ventana, sin abrir una segunda copia.

North también avisa en el centro de notificaciones cuando una VPN se conecta, se apaga o pierde la conexión, con su nombre. **Avisos de VPN** en Configuración → Inicio enciende o apaga esos avisos y empieza encendido. Salir de North apaga las VPNs sin ese aviso.

## Varias VPNs a la vez

Dos VPNs con redes distintas pueden quedar activas juntas. Si las redes se superponen, o una redirige todo el tráfico, North avisa antes y te deja elegir **Apagar y conectar**, **Conectar de todos modos** o **Cancelar**.

## Cuando algo sale mal

El mensaje dice qué pasó y ofrece la acción correcta: **Actualizar contraseña** cuando el servidor rechaza la credencial, **Reintentar** cuando el servidor no responde o se deniega el permiso de administrador, **Cómo instalar** cuando falta OpenVPN. En **Logs**, **Copiar diagnóstico** copia el log ya sin contraseñas.

Si el síntoma aparece con la VPN ya encendida (por ejemplo un `git push` que devuelve HTTP 408), consulta [Problemas conocidos](troubleshooting).

## Encender la VPN automáticamente

En **Editar ambiente** (o **Editar cliente**), elige su **VPN**. Desde entonces, abrir una sesión SSH, RDP, de base de datos o API de ese ambiente enciende primero la VPN, espera a que el servidor responda y solo entonces abre la sesión; varias sesiones comparten el mismo túnel, que se apaga solo cuando se cierra la última (si la VPN tiene apagado automático). Vale la VPN del ambiente; sin ella, la del cliente. En cada conexión o acceso, el campo **VPN** ofrece **Heredar** (por defecto), **Nunca usar VPN** u otra VPN. Si la VPN falla, la sesión muestra el error con su nombre. El monitor de conexiones no marca como caído un servidor mientras su VPN está apagada.

**Abrir URL** en un acceso de login (portal web) también enciende la VPN heredada antes de abrir el navegador. Como North no sabe cuándo terminaste de usar el sitio, esa VPN queda encendida hasta que hagas clic en **Apagar**.

## VPN en una organización

Cada workspace tiene su propia lista de VPN: en la organización, la pantalla **VPNs** muestra solo las VPN que usas allí, y Mi workspace mantiene las suyas. La VPN queda en tu computadora, con tu propio usuario y contraseña, y el túnel sube solo en tu computadora: apagar tu VPN nunca desconecta la de nadie.

Qué VPN usa un cliente, ambiente, conexión o base de datos es elección **tuya**. Si eliges otra VPN, incluso con otro gateway, solo cambia la tuya. La primera elección hecha en un elemento se vuelve la **sugerencia** de la organización para quien aún no eligió. Al copiar de Mi workspace a la organización, las VPN van juntas, con tu login, ya vinculadas a los clientes copiados.

Cuando alguien vincula una VPN FortiGate, IPsec o de Windows a un cliente, ambiente, conexión o base de datos de la organización, el servidor guarda solo su "plantilla": nombre, gateway, puerto, realm y el certificado de confianza. Nunca guarda usuario, contraseña ni clave precompartida.

La primera vez que abres algo de la organización que necesita esa VPN, North busca una VPN tuya con el mismo gateway y la usa. Si todavía no tienes, crea la VPN a partir de la plantilla, faltando solo tu login: en la primera conexión North avisa, y abres la VPN en **VPNs → Editar** y completas tu usuario y contraseña (y la clave precompartida, en IPsec). Desde entonces, hacer clic en el SSH, la base de datos o el portal levanta la VPN sola, como en Mi workspace. Cada persona entra en la FortiGate con su propio login, así la FortiGate sabe quién es quién.

Con OpenVPN, la organización guarda solo la dirección del servidor de la VPN: el archivo `.ovpn` suele llevar el certificado y la clave de quien lo exportó, y eso nunca sale de tu equipo. Cada persona importa su propio `.ovpn` una vez en la pantalla **VPNs** (arrastra el archivo o usa **Elegir archivo .ovpn**), y North lo reconoce por la dirección y lo conecta solo. Quien aún no lo importó ve el aviso para importarlo al conectar.
