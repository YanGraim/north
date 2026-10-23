## VPNs

- **SSL-VPN do FortiGate no Windows:** VPNs que enviam muitas rotas, e que caíam logo depois de conectar e ficavam reconectando sem parar, agora conectam normalmente. O North não espera mais o Windows terminar de criar todas as rotas para manter o túnel
- **SSL-VPN do FortiGate no Windows sem quedas:** o North não usa mais o canal UDP (DTLS) com o FortiGate, só TLS, como já fazia no Mac. Isso acaba com as VPNs que caíam segundos depois de conectar, com "Detected dead peer" no log

Veja o capítulo [VPNs](vpns) no manual.
