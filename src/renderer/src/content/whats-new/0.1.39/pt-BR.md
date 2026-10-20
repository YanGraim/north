## Importar / exportar

- **Workflows e variáveis no backup:** o JSON exportado agora leva os workflows e as variáveis de cada grupo, e eles chegam prontos no outro North
- **VPNs FortiGate no backup:** as VPNs SSL-VPN e IPsec vão no arquivo, junto com qual VPN cada cliente, ambiente e conexão usa. Usuário e senha não vão (são pessoais): ao conectar, o North pede para preencher o seu. OpenVPN fica de fora, porque cada um tem o próprio `.ovpn`

Veja o capítulo [Importar / exportar](import-export) no manual.
