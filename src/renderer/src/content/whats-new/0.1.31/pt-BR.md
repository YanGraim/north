## VPNs

- **VPNs dentro do North:** importe o `.ovpn` do cliente (arrastando para a tela) e ligue a VPN pela nova pílula **VPN** na barra superior, sem abrir o OpenVPN Connect. As credenciais ficam no cofre, e o North pede só o que o arquivo exige
- **Várias VPNs juntas:** ligue mais de uma ao mesmo tempo; se as redes se sobrepuserem, o North avisa antes de conectar
- **FortiGate SSL-VPN:** os mesmos campos da aba SSL-VPN do FortiClient, com confirmação da impressão digital do certificado na primeira conexão (macOS e Linux)
- **Sem senha a cada conexão:** instale o componente de VPN uma vez (o North oferece na primeira abertura) e SSL-VPN, IPsec e OpenVPN deixam de pedir a senha de administrador
- **FortiGate/IPsec:** cadastre com os mesmos campos do FortiClient e conecte pelo strongSwan com as mesmas propostas dele, sem o FortiClient e sem aprovar perfil em Ajustes (macOS e Linux)

Veja o capítulo [VPNs](vpns) no manual.
