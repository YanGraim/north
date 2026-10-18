# VPNs

O North guarda as VPNs dos seus clientes e liga cada uma com um clique, sem abrir o FortiClient ou o OpenVPN Connect. A VPN vale para o sistema inteiro, inclusive para o navegador.

## Cadastrar

Em **VPNs** na barra lateral, clique em **Nova VPN** ou arraste um arquivo `.ovpn` para a tela.

- **OpenVPN (.ovpn):** o North lê o arquivo, mostra o servidor e pede **só** o que ele exige: usuário e senha, senha da chave privada ou nada. Arquivos que tentam executar scripts (`up`, `down`, `plugin`, `script-security 2`…) são recusados, com o motivo na tela.
- **FortiGate SSL-VPN:** a aba "SSL-VPN" do FortiClient. Preencha nome, gateway remoto, porta, usuário e senha; se você colar `ip:porta` no gateway, o North separa os dois. Muitos FortiGates usam certificado próprio: na primeira conexão o North mostra a impressão digital (SHA-256) e só conecta depois que você clicar em **Confiar neste certificado e conectar**. Se o certificado mudar depois, ele bloqueia e avisa. Precisa do `openfortivpn` instalado (`brew install openfortivpn` no macOS). Funciona no macOS e no Linux; o Windows chega numa próxima versão.
- **FortiGate / IPsec (IKEv1) e IKEv2:** os campos têm os mesmos nomes e a mesma ordem do FortiClient (gateway remoto, chave pré-compartilhada, XAuth, usuário). No macOS, a FortiGate IKEv1 conecta pelo cliente IPsec do próprio sistema: na primeira conexão o North abre um perfil "North" e o macOS pede para você aprová-lo em **Ajustes do Sistema → Geral → Gerenciamento de Dispositivos**. Depois disso é só ligar. Se você mudar a senha ou a chave, o macOS pede a aprovação de novo. IKEv2 e o Windows ainda ficam só cadastrados.

Senhas, chave pré-compartilhada e as chaves privadas embutidas no `.ovpn` vão para o cofre do North e nunca aparecem nos logs.

## Editar

No topo da VPN, **Editar** abre a configuração. Em **Conexão** você muda o tipo (SSL-VPN, IPsec ou IKEv2), o gateway, a porta, o usuário, o grupo e o XAuth sem apagar a VPN; as credenciais salvas continuam valendo. Numa OpenVPN, **Substituir arquivo .ovpn** troca o arquivo e mantém nome, cliente e senha. Se o gateway ou a porta mudar, o North pede para confirmar o certificado de novo.

## Ligar e desligar

- Pela pílula **VPN** na barra superior: cada VPN tem um switch, com status, IP e tempo ligada. A pílula fica verde com uma VPN ativa, mostra "2 VPNs" com duas, âmbar enquanto conecta e vermelha se uma cair.
- Pela tela **VPNs**: botão **Conectar** / **Desligar** e abas **Visão geral**, **Configuração**, **Logs** e **Histórico**.

O macOS e o Linux precisam de permissão de administrador para a VPN mexer em rotas e DNS. Na primeira abertura com VPNs, o North oferece instalar o **componente de VPN** (como o FortiClient faz): o sistema pede a senha uma única vez e, depois disso, a SSL-VPN conecta e desconecta sem pedir senha. Se você recusar, ele oferece de novo na primeira conexão; o botão no fim da lista de VPNs instala ou remove o componente. O componente só aceita conectar e desconectar VPNs, nada além disso. Sem ele, cada conexão pede a senha. O OpenVPN precisa estar instalado (`brew install openvpn` no macOS).

## Várias VPNs ao mesmo tempo

Duas VPNs com redes diferentes podem ficar ligadas juntas. Se as redes se sobrepõem, ou se uma delas redireciona todo o tráfego, o North avisa antes e deixa você escolher entre **Desligar e conectar**, **Conectar mesmo assim** ou **Cancelar**.

## Quando algo dá errado

A mensagem diz o que aconteceu e oferece a ação certa: **Atualizar senha** quando o servidor recusa a credencial, **Tentar de novo** quando o servidor não responde ou o pedido de administrador é negado, **Como instalar** quando falta o OpenVPN. Em **Logs**, **Copiar diagnóstico** copia o log já sem senhas.
