# VPNs

O North guarda as VPNs dos seus clientes e liga cada uma com um clique, sem abrir o FortiClient ou o OpenVPN Connect. A VPN vale para o sistema inteiro, inclusive para o navegador.

## Cadastrar

Em **VPNs** na barra lateral, clique em **Nova VPN** ou arraste um arquivo `.ovpn` para a tela.

- **OpenVPN (.ovpn):** o North lê o arquivo, mostra o servidor e pede **só** o que ele exige: usuário e senha, senha da chave privada ou nada. Arquivos que tentam executar scripts (`up`, `down`, `plugin`, `script-security 2`…) são recusados, com o motivo na tela.
- **FortiGate / IPsec (IKEv1) e IKEv2:** os campos têm os mesmos nomes e a mesma ordem do FortiClient (gateway remoto, chave pré-compartilhada, XAuth, usuário). Por enquanto esses tipos ficam só cadastrados; a conexão chega numa próxima versão.

Senhas, chave pré-compartilhada e as chaves privadas embutidas no `.ovpn` vão para o cofre do North e nunca aparecem nos logs.

## Ligar e desligar

- Pela pílula **VPN** na barra superior: cada VPN tem um switch, com status, IP e tempo ligada. A pílula fica verde com uma VPN ativa, mostra "2 VPNs" com duas, âmbar enquanto conecta e vermelha se uma cair.
- Pela tela **VPNs**: botão **Conectar** / **Desligar** e abas **Visão geral**, **Configuração**, **Logs** e **Histórico**.

O macOS e o Linux pedem a senha de administrador a cada conexão, porque a VPN mexe em rotas e DNS. O OpenVPN precisa estar instalado (`brew install openvpn` no macOS).

## Várias VPNs ao mesmo tempo

Duas VPNs com redes diferentes podem ficar ligadas juntas. Se as redes se sobrepõem, ou se uma delas redireciona todo o tráfego, o North avisa antes e deixa você escolher entre **Desligar e conectar**, **Conectar mesmo assim** ou **Cancelar**.

## Quando algo dá errado

A mensagem diz o que aconteceu e oferece a ação certa: **Atualizar senha** quando o servidor recusa a credencial, **Tentar de novo** quando o servidor não responde ou o pedido de administrador é negado, **Como instalar** quando falta o OpenVPN. Em **Logs**, **Copiar diagnóstico** copia o log já sem senhas.
