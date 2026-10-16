# VPNs

North guarda las VPNs de tus clientes y activa cada una con un clic, sin abrir FortiClient ni OpenVPN Connect. La VPN vale para todo el sistema, incluido el navegador.

## Registrar

En **VPNs** en la barra lateral, haz clic en **Nueva VPN** o arrastra un archivo `.ovpn` a la pantalla.

- **OpenVPN (.ovpn):** North lee el archivo, muestra el servidor y pide **solo** lo que exige: usuario y contraseña, contraseña de la clave privada o nada. Los archivos que intentan ejecutar scripts (`up`, `down`, `plugin`, `script-security 2`…) se rechazan, con el motivo en pantalla.
- **FortiGate / IPsec (IKEv1) e IKEv2:** los campos tienen los mismos nombres y el mismo orden que FortiClient (gateway remoto, clave precompartida, XAuth, usuario). Por ahora estos tipos solo se registran; la conexión llega en una próxima versión.

Las contraseñas, la clave precompartida y las claves privadas incluidas en el `.ovpn` van al cofre de North y nunca aparecen en los logs.

## Activar y apagar

- Desde la píldora **VPN** de la barra superior: cada VPN tiene un switch, con estado, IP y tiempo activa. La píldora se pone verde con una VPN activa, muestra "2 VPNs" con dos, ámbar mientras conecta y roja si una se cae.
- Desde la pantalla **VPNs**: botón **Conectar** / **Apagar** y las pestañas **Resumen**, **Configuración**, **Logs** e **Historial**.

macOS y Linux piden la contraseña de administrador en cada conexión, porque la VPN cambia rutas y DNS. OpenVPN debe estar instalado (`brew install openvpn` en macOS).

## Varias VPNs a la vez

Dos VPNs con redes distintas pueden quedar activas juntas. Si las redes se superponen, o una redirige todo el tráfico, North avisa antes y te deja elegir **Apagar y conectar**, **Conectar de todos modos** o **Cancelar**.

## Cuando algo sale mal

El mensaje dice qué pasó y ofrece la acción correcta: **Actualizar contraseña** cuando el servidor rechaza la credencial, **Reintentar** cuando el servidor no responde o se deniega el permiso de administrador, **Cómo instalar** cuando falta OpenVPN. En **Logs**, **Copiar diagnóstico** copia el log ya sin contraseñas.
