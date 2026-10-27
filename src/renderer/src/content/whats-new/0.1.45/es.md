## VPN en Windows y Mac

- **Componente de VPN en Windows:** en equipos sin OpenVPN, la instalación se detenía a la mitad y la VPN fallaba con *No se pudo instalar el componente de VPN de North*. Ahora OpenVPN y el servicio de VPN de North se instalan juntos, con una sola solicitud de administrador
- **FortiGate SSL-VPN en Mac:** North corrige la ruta cuando el FortiGate usa su propia IP como extremo del túnel, y el error de tiempo agotado ahora indica si el inicio de sesión ya había sido aceptado

Consulta el capítulo [VPNs](vpns) del manual.
