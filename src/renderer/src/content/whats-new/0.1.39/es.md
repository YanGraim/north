## Importar / exportar

- **Workflows y variables en la copia:** el JSON exportado ahora lleva los workflows y las variables de cada grupo, listos en el otro North
- **VPNs FortiGate en la copia:** las VPNs SSL-VPN e IPsec van en el archivo, junto con qué VPN usa cada cliente, entorno y conexión. Usuario y contraseña no van (son personales): al conectar, North te pide completar el tuyo. OpenVPN queda fuera, porque cada uno tiene su propio `.ovpn`

Consulta el capítulo [Importar / exportar](import-export) del manual.

## VPN de Windows

- **Nueva VPN de Windows (solo en Windows):** en **Nueva VPN**, elige **VPN de Windows** y el protocolo: Automático, PPTP, L2TP/IPsec con clave precompartida, SSTP o IKEv2, igual que Windows. Se enciende desde North, desde el ícono de la bandeja o sola antes de las sesiones, y va en el respaldo sin usuario ni contraseña

Consulta el capítulo [VPNs](vpns) del manual.

## Inicio

- **Abrir North con el sistema (opcional):** en Configuración → Inicio, North puede abrirse solo al iniciar sesión en Windows, macOS o Linux. Desactivado por defecto
