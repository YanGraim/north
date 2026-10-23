## VPNs

- **Abrir URL enciende la VPN:** en un acceso de login (portal web), **Abrir URL** primero enciende la VPN heredada del ambiente o del cliente y después abre el navegador. Esa VPN queda encendida hasta que hagas clic en **Apagar**
- **Contraseña XAuth rechazada:** cuando el FortiGate rechaza el usuario o la contraseña de una VPN IPsec, North avisa en el momento en vez de esperar el tiempo límite
- **Servicio de VPN detenido en Windows:** si el servicio North VPN está detenido, North lo reinstala y lo vuelve a iniciar al conectar, pidiendo permiso de administrador una vez. El error ahora dice "Componente de VPN no encontrado" en vez de nombrar a OpenVPN
- **Log de OpenVPN en Windows:** el log muestra los pasos de la conexión y lo que OpenVPN registró desde el inicio, y el tiempo límite indica en qué paso se detuvo

Consulta el capítulo [VPNs](vpns) del manual.
