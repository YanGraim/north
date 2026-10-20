## VPNs

- **OpenVPN con MikroTik:** los servidores OpenVPN en MikroTik (RouterOS), que cortaban la conexión justo después del inicio de sesión, ahora conectan con el `.ovpn` original. North ajusta solo el TLS y el cifrado que exigen
- **Log de la VPN más útil:** cada nueva conexión empieza un log limpio, sin líneas repetidas, y muestra el motivo cuando el servidor corta la conexión. Si la corta tres veces seguidas justo después del inicio de sesión, North se detiene y avisa en vez de esperar el tiempo límite
- **Menú de la bandeja:** cada VPN muestra un punto de estado, verde cuando está conectada, naranja conectando y gris apagada, en macOS, Windows y Linux
- **Indicador de la barra de título:** el nombre mostrado ahora es el de la VPN que está conectando o con error, igual al color del punto

Consulta el capítulo [VPNs](vpns) del manual.
