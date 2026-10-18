## VPNs

- **VPNs dentro de North:** importa el `.ovpn` del cliente (arrastrándolo a la pantalla) y activa la VPN desde la nueva píldora **VPN** de la barra superior, sin abrir OpenVPN Connect. Las credenciales quedan en el cofre, y North pide solo lo que el archivo exige
- **Varias VPNs a la vez:** activa más de una al mismo tiempo; si las redes se superponen, North avisa antes de conectar
- **FortiGate SSL-VPN:** los mismos campos de la pestaña SSL-VPN de FortiClient, con confirmación de la huella del certificado en la primera conexión (macOS y Linux)
- **Sin contraseña en cada conexión:** instala el componente de VPN una vez (North lo ofrece en el primer inicio) y la SSL-VPN deja de pedir la contraseña de administrador
- **FortiGate/IPsec en macOS:** regístrala con los mismos campos de FortiClient y conéctala con el cliente IPsec del propio macOS, sin FortiClient (la primera vez, aprueba el perfil "North" en Ajustes del Sistema)

Ver el capítulo [VPNs](vpns) en el manual.
