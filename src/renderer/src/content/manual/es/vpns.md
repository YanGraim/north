# VPNs

North guarda las VPNs de tus clientes y activa cada una con un clic, sin abrir FortiClient ni OpenVPN Connect. La VPN vale para todo el sistema, incluido el navegador.

## Registrar

En **VPNs** en la barra lateral, haz clic en **Nueva VPN** o arrastra un archivo `.ovpn` a la pantalla.

- **OpenVPN (.ovpn):** North lee el archivo, muestra el servidor y pide **solo** lo que exige: usuario y contraseña, contraseña de la clave privada o nada. Los archivos que intentan ejecutar scripts (`up`, `down`, `plugin`, `script-security 2`…) se rechazan, con el motivo en pantalla.
- **FortiGate SSL-VPN:** la pestaña "SSL-VPN" de FortiClient. Completa nombre, gateway remoto, puerto, usuario y contraseña; si pegas `ip:puerto` en el gateway, North lo separa. Muchos FortiGates usan certificado propio: en la primera conexión North muestra la huella (SHA-256) y solo conecta después de que hagas clic en **Confiar en este certificado y conectar**. Si el certificado cambia después, bloquea y avisa. Requiere `openfortivpn` (`brew install openfortivpn` en macOS). Funciona en macOS y Linux; Windows llega en una próxima versión.
- **FortiGate / IPsec (IKEv1) e IKEv2:** los campos tienen los mismos nombres y el mismo orden que FortiClient (gateway remoto, clave precompartida, XAuth, usuario). En macOS, la FortiGate IKEv1 se conecta con el cliente IPsec del propio sistema: en la primera conexión North abre un perfil "North" y macOS pide que lo apruebes en **Ajustes del Sistema → General → Gestión de dispositivos**. Después basta con activarla. Si cambias la contraseña o la clave, macOS pide aprobarlo de nuevo. IKEv2 y Windows por ahora solo se registran.

Las contraseñas, la clave precompartida y las claves privadas incluidas en el `.ovpn` van al cofre de North y nunca aparecen en los logs.

## Editar

Arriba de la VPN, **Editar** abre la configuración. En **Conexión** cambias el tipo (SSL-VPN, IPsec o IKEv2), el gateway, el puerto, el usuario, el grupo y el XAuth sin borrar la VPN; las credenciales guardadas siguen valiendo. En una OpenVPN, **Reemplazar archivo .ovpn** cambia el archivo y mantiene nombre, cliente y contraseña. Si cambia el gateway o el puerto, North pide confirmar el certificado de nuevo.

## Activar y apagar

- Desde la píldora **VPN** de la barra superior: cada VPN tiene un switch, con estado, IP y tiempo activa. La píldora se pone verde con una VPN activa, muestra "2 VPNs" con dos, ámbar mientras conecta y roja si una se cae.
- Desde la pantalla **VPNs**: botón **Conectar** / **Apagar** y las pestañas **Resumen**, **Configuración**, **Logs** e **Historial**.

macOS y Linux necesitan permiso de administrador para que la VPN cambie rutas y DNS. En el primer inicio con VPN, North ofrece instalar el **componente de VPN** (como hace FortiClient): el sistema pide la contraseña una sola vez y, a partir de ahí, la SSL-VPN se conecta y desconecta sin pedirla. Si lo rechazas, lo ofrece de nuevo en la primera conexión; el botón al final de la lista de VPN lo instala o lo quita. El componente solo puede conectar y desconectar VPN, nada más. Sin él, cada conexión pide la contraseña. OpenVPN debe estar instalado (`brew install openvpn` en macOS).

## Varias VPNs a la vez

Dos VPNs con redes distintas pueden quedar activas juntas. Si las redes se superponen, o una redirige todo el tráfico, North avisa antes y te deja elegir **Apagar y conectar**, **Conectar de todos modos** o **Cancelar**.

## Cuando algo sale mal

El mensaje dice qué pasó y ofrece la acción correcta: **Actualizar contraseña** cuando el servidor rechaza la credencial, **Reintentar** cuando el servidor no responde o se deniega el permiso de administrador, **Cómo instalar** cuando falta OpenVPN. En **Logs**, **Copiar diagnóstico** copia el log ya sin contraseñas.
