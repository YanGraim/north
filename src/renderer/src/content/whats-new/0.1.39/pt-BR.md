## Importar / exportar

- **Workflows e variáveis no backup:** o JSON exportado agora leva os workflows e as variáveis de cada grupo, e eles chegam prontos no outro North
- **VPNs FortiGate no backup:** as VPNs SSL-VPN e IPsec vão no arquivo, junto com qual VPN cada cliente, ambiente e conexão usa. Usuário e senha não vão (são pessoais): ao conectar, o North pede para preencher o seu. OpenVPN fica de fora, porque cada um tem o próprio `.ovpn`

Veja o capítulo [Importar / exportar](import-export) no manual.

## VPN do Windows

- **Nova VPN do Windows (só no Windows):** em **Nova VPN**, escolha **VPN do Windows** e o protocolo: Automático, PPTP, L2TP/IPsec com chave pré-compartilhada, SSTP ou IKEv2, igual ao Windows. Liga pelo North, pelo ícone na bandeja e sozinha antes das sessões, e vai no backup sem usuário e senha

Veja o capítulo [VPNs](vpns) no manual.
