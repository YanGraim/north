# VPNs

O North guarda as VPNs dos seus clientes e liga cada uma com um clique, sem abrir o FortiClient ou o OpenVPN Connect. A VPN vale para o sistema inteiro, inclusive para o navegador.

## Cadastrar

Em **VPNs** na barra lateral, clique em **Nova VPN** ou arraste um arquivo `.ovpn` para a tela.

- **OpenVPN (.ovpn):** o North lê o arquivo, mostra o servidor e pede **só** o que ele exige: usuário e senha, senha da chave privada ou nada. Arquivos que tentam executar scripts (`up`, `down`, `plugin`, `script-security 2`…) são recusados, com o motivo na tela. Servidores OpenVPN em MikroTik (RouterOS) costumam derrubar a conexão logo depois do login com o OpenVPN 2.6. Quando o certificado do `.ovpn` foi gerado pelo RouterOS, o North adiciona sozinho `tls-version-max 1.2`, `data-ciphers` com a cifra do arquivo e `tls-cipher DEFAULT:@SECLEVEL=0`; o que o arquivo já define continua valendo.
- **FortiGate SSL-VPN:** a aba "SSL-VPN" do FortiClient. Preencha nome, gateway remoto, porta, usuário e senha; se você colar `ip:porta` no gateway, o North separa os dois. Muitos FortiGates usam certificado próprio: na primeira conexão o North mostra a impressão digital (SHA-256) e só conecta depois que você clicar em **Confiar neste certificado e conectar**. Se o certificado mudar depois, ele bloqueia e avisa. No Linux, precisa do pacote `ppp` (já vem na maioria das distribuições). Funciona no macOS, no Linux e no Windows (pelo OpenConnect, que o North traz junto).
- **FortiGate / IPsec (IKEv1) e IKEv2:** os campos têm os mesmos nomes e a mesma ordem do FortiClient (gateway remoto, chave pré-compartilhada, XAuth, usuário). A FortiGate IKEv1 conecta pelo strongSwan com as mesmas propostas do FortiClient (AES, SHA1/SHA256, grupo DH 5), sem perfil para aprovar em Ajustes e, com o componente de VPN instalado, sem pedir senha. No Windows, o North roda o mesmo strongSwan dentro de um pequeno Linux próprio no WSL (precisa do WSL ativo: `wsl --install`), que só fica ligado enquanto a VPN está conectada; funciona com VPNs de túnel dividido, e sem o WSL use o FortiClient para ela. O IKEv2 ainda fica só cadastrado. Se você acessa servidores da VPN por nome, preencha **Domínios internos** em Editar (ex.: `empresa.local`): só esses nomes usam o DNS da VPN, o resto continua no seu DNS (macOS).
- **VPN do Windows (só no Windows):** o cliente VPN do próprio Windows, como em Configurações → VPN. Preencha nome, endereço do servidor, tipo de VPN (Automático, PPTP, L2TP/IPsec com chave pré-compartilhada, SSTP ou IKEv2), usuário e senha. O North cria a conexão no Windows com o nome "North …" e liga e desliga por ele, sem pedir senha de administrador; a senha vai direto para o Windows, nunca pela linha de comando. Por padrão só as redes da VPN passam por ela (túnel dividido).

Senhas, chave pré-compartilhada e as chaves privadas embutidas no `.ovpn` vão para o cofre do North e nunca aparecem nos logs.

## Editar

No topo da VPN, **Editar** abre a configuração. Em **Conexão** você muda o tipo (SSL-VPN, IPsec ou IKEv2), o gateway, a porta, o usuário, o grupo e o XAuth sem apagar a VPN; as credenciais salvas continuam valendo. Numa OpenVPN, **Substituir arquivo .ovpn** troca o arquivo e mantém nome, cliente e senha. Se o gateway ou a porta mudar, o North pede para confirmar o certificado de novo.

## Ligar e desligar

- Pela pílula **VPN** na barra superior: cada VPN tem um switch, com status, IP e tempo ligada. A pílula fica verde com uma VPN ativa, mostra "2 VPNs" com duas, âmbar enquanto conecta e vermelha se uma cair.
- Pela tela **VPNs**: botão **Conectar** / **Desligar** e abas **Visão geral**, **Configuração**, **Logs** e **Histórico**.

O macOS e o Linux precisam de permissão de administrador para a VPN mexer em rotas e DNS. Na primeira abertura com VPNs, o North oferece instalar o **componente de VPN** (como o FortiClient faz): o sistema pede a senha uma única vez e, depois disso, SSL-VPN, IPsec e OpenVPN conectam e desconectam sem pedir senha. Se você recusar, ele oferece de novo na primeira conexão; o botão no fim da lista de VPNs instala ou remove o componente. O componente só aceita conectar e desconectar VPNs, nada além disso. Sem ele, cada conexão pede a senha. Um `.ovpn` com opções fora do comum (scripts, arquivos externos) continua pedindo a senha a cada conexão, por segurança. No Windows, o componente é o pacote oficial do OpenVPN (sem a interface dele) mais um pequeno serviço do North para a SSL-VPN: os dois entram na primeira conexão, com uma única permissão do Windows. O North já traz o openfortivpn, o strongSwan e o OpenVPN no macOS e no Linux: não precisa instalar nada (as licenças ficam junto deles, na pasta `vpn-bin` do app).

## Pelo ícone do North, sem abrir a janela

O North fica com um ícone na barra de menus (macOS) ou na bandeja perto do relógio (Windows e Linux). Clique nele para ver as VPNs e ligar ou desligar qualquer uma com um clique, como no FortiClient. **Abrir North** traz a janela de volta e **Sair do North** desliga as VPNs e fecha o app.

Com pelo menos uma VPN cadastrada, fechar a janela não fecha o North: ele continua no ícone e as VPNs seguem ligadas. Para fechar de verdade, use **Sair do North** no ícone (ou Cmd+Q no macOS). Abrir o North de novo pelo atalho traz a mesma janela, sem abrir uma segunda cópia.

## Várias VPNs ao mesmo tempo

Duas VPNs com redes diferentes podem ficar ligadas juntas. Se as redes se sobrepõem, ou se uma delas redireciona todo o tráfego, o North avisa antes e deixa você escolher entre **Desligar e conectar**, **Conectar mesmo assim** ou **Cancelar**.

## Quando algo dá errado

A mensagem diz o que aconteceu e oferece a ação certa: **Atualizar senha** quando o servidor recusa a credencial, **Tentar de novo** quando o servidor não responde ou o pedido de administrador é negado, **Como instalar** quando falta o OpenVPN. Em **Logs**, **Copiar diagnóstico** copia o log já sem senhas.

## Ligar a VPN sozinha

Em **Editar ambiente** (ou **Editar cliente**), escolha a **VPN** dele. A partir daí, abrir uma conexão SSH, RDP, banco ou API desse ambiente liga a VPN antes, espera o servidor responder e só então abre a sessão; várias sessões dividem o mesmo túnel, que desliga sozinho quando a última fecha (se a VPN estiver em desligamento automático). O ambiente usa a própria VPN; sem ela, vale a do cliente. Em cada conexão ou acesso, o campo **VPN** permite **Herdar** (padrão), **Nunca usar VPN** ou escolher outra. Se a VPN falhar, a sessão mostra o erro com o nome dela. O monitor de conexões não marca como fora do ar um servidor cuja VPN está desligada.
