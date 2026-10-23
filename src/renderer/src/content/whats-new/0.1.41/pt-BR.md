## VPNs

- **Abrir URL liga a VPN:** num acesso de login (portal web), **Abrir URL** liga antes a VPN herdada do ambiente ou do cliente e só depois abre o navegador. Essa VPN fica ligada até você clicar em **Desligar**
- **Senha do XAuth recusada:** quando o FortiGate recusa o usuário ou a senha de uma VPN IPsec, o North avisa na hora, em vez de esperar o tempo limite
- **Serviço de VPN parado no Windows:** se o serviço North VPN estiver parado, o North reinstala e inicia ele de novo ao conectar, pedindo permissão de administrador uma vez. A mensagem de erro agora diz "Componente de VPN não encontrado" em vez de citar o OpenVPN
- **Log da OpenVPN no Windows:** o log mostra as etapas da conexão e o que o OpenVPN registrou desde o início, e o tempo limite diz em qual etapa parou

Veja o capítulo [VPNs](vpns) no manual.
