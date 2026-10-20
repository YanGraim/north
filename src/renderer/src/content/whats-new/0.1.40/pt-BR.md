## VPNs

- **OpenVPN com MikroTik:** servidores OpenVPN em MikroTik (RouterOS), que derrubavam a conexão logo depois do login, agora conectam com o `.ovpn` original. O North ajusta sozinho o TLS e a cifra que eles exigem
- **Log da VPN mais útil:** cada nova conexão começa um log limpo, sem linhas repetidas, e mostra o motivo quando o servidor derruba a conexão. Se ele derrubar três vezes seguidas logo depois do login, o North para e avisa, em vez de esperar o tempo limite
- **Menu da bandeja:** cada VPN aparece com uma bolinha de status, verde quando conectada, laranja conectando e cinza desligada, no macOS, no Windows e no Linux
- **Indicador da barra de título:** o nome mostrado agora é o da VPN que está conectando ou com erro, igual à cor da bolinha

Veja o capítulo [VPNs](vpns) no manual.
