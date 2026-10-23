## VPNs

- **SSL-VPN de FortiGate en Windows:** las VPN que envían muchas rutas, que se caían justo después de conectar y se reconectaban sin parar, ahora conectan normalmente. North ya no espera a que Windows termine de crear todas las rutas para mantener el túnel
- **SSL-VPN de FortiGate en Windows sin caídas:** North ya no usa el canal UDP (DTLS) con el FortiGate, solo TLS, como ya hacía en Mac. Esto termina con las VPN que se caían segundos después de conectar, con "Detected dead peer" en el log

Consulta el capítulo [VPNs](vpns) del manual.
