# Conectar

Para abrir uma sessão:

1. Selecione uma **conexão** na lista.
2. Use **Conectar** (ou Enter na Command Palette).
3. A sessão abre em uma **aba** no workspace — terminal, desktop, arquivos ou **estúdio SQL**, conforme o tipo.

Bancos cadastrados como Access (PostgreSQL, MySQL/MariaDB, SQL Server, SQLite) também têm **Conectar**. Detalhes no capítulo **Estúdio SQL**.

## Workflows (SSH)

No botão **Conectar**, o menu split também lista workflows do grupo. Você pode abrir a sessão interativa ou disparar um workflow sem sair do inventário. Detalhes no capítulo **Workflows**.

## Host key (SSH)

Na primeira conexão SSH, o North pede confirmação da chave do host. Aceite só se o fingerprint bater com o esperado.

## Agente SSH (git no servidor)

Para rodar `git pull`/`git push` dentro de um servidor usando a chave do **seu** computador (sem copiá-la para lá), ligue **Encaminhar agente SSH (ssh -A)** na conexão. É o mesmo que `ssh -A` no terminal e vem desligado por padrão.

1. Carregue a chave no agente local: `ssh-add ~/.ssh/id_ed25519`. No Windows, o serviço **OpenSSH Authentication Agent** precisa estar habilitado.
2. Ligue a opção na conexão e conecte.
3. No servidor, teste com `ssh -T git@seu-gitlab` (ou o comando que o seu GitLab indicar).

Ligue só em servidores confiáveis: quem tiver root no servidor pode usar o agente enquanto a sessão estiver aberta. Se o agente não estiver rodando ou o servidor bloquear o encaminhamento, a sessão abre normalmente, só sem o agente, e o North mostra um aviso amarelo no terminal dizendo o motivo.

## Terminal

Na aba de sessão terminal:

- A barra no topo mostra `usuário@host`, a pasta do **ambiente** e o badge **HML** / **PROD** / **DEV** quando o nome tem contexto — a aba também leva o rótulo curto, junto com o nome do **cliente**, pra diferenciar abas do mesmo ambiente em clientes diferentes.
- O terminal acompanha a saída enquanto você está no fim; se subir o histórico, a rolagem não puxa de volta.
- Clique na linha de comando atual para posicionar o cursor (sem precisar das setas). Arrastar continua selecionando texto.
- O botão do meio copia o texto selecionado e tira a seleção. Sem seleção, cola o que está na área de transferência, inclusive uma imagem, que vira caminho. O botão direito continua abrindo o menu.
- Em **Configurações**, na seção **Terminal**, **Botão direito copia ou cola** troca esses papéis. Nasce desligado. Ligado, o direito copia ou cola e o meio abre o mesmo menu. Fora do terminal, os botões não mudam.
- **⌘A** (macOS) ou **Ctrl+A** (Windows/Linux) seleciona o texto digitado na linha (não o prompt); pressione de novo para selecionar todo o histórico. Com a seleção ativa, **Backspace** / **Delete** apaga esse texto; **⌘X** / **Ctrl+X** corta (copia e apaga). No Mac, **Ctrl+A** segue indo ao shell (início da linha).
- O menu de contexto (botão direito) tem **Colar senha salva** quando a conexão tem senha ou senha de sudo salva — cola a senha guardada no vault direto no terminal (útil para `sudo su` e afins), sem passar pelo clipboard do sistema.
- Colar uma imagem (⌘V/Ctrl+V com uma imagem copiada, por exemplo um screenshot) salva ela num arquivo temporário e cola o caminho como texto — do jeito que iTerm2/Terminal.app fazem. Útil pra mandar uma imagem pra CLIs de agente (Claude Code e similares) rodando no terminal.
- Se a conexão SSH tem **Diretório inicial**, o shell já abre nessa pasta (`/var/www` ou `~/app`). Sem o campo, abre no diretório de login, como antes. Se a pasta não existir ou não der para entrar, a sessão continua no login e uma linha amarela `[North]` diz o motivo.
- No terminal SSH de uma conexão salva, a badge **Arquivos** fica ao lado do ambiente (ou da pasta, quando não há ambiente) e abre um painel à direita do terminal com os arquivos da pasta em que o shell está. O North lê essa pasta pelo prompt do bash e do zsh desta sessão; um `cd` atualiza a lista. Entrar numa pasta, subir, ir para a pasta inicial ou clicar num trecho do caminho escreve `cd` no shell. A lista só muda quando o prompt confirma a pasta. Se a linha já tiver texto, o `cd` espera. Dá para baixar — o North pede a pasta de destino —, enviar, abrir, criar, renomear e excluir, e também gravar o diretório inicial e acompanhar um log. Atualizar só relê a mesma pasta. Enquanto a pasta não chega, o painel avisa e não mostra o diretório de login no lugar. Fechar a badge esconde o painel. Shell local, Telnet, serial, workspace de agente, workflow, FTP, RDP e o navegador de arquivos não têm essa badge.
- Em **Arquivos de log**, cada caminho (`/var/log/app.log` ou `~/app/app.log`) ganha um quadro que acompanha o arquivo e continua depois da rotação. **Acompanhar** abre o quadro na faixa de baixo. **Destacar** leva o quadro para uma janela que continua visível com a janela principal minimizada. Fechar o quadro ou o app encerra o acompanhamento. Sem arquivos, nada muda.
- No menu de contexto do terminal SSH, **Definir diretório padrão** grava a pasta selecionada — ou a pasta do arquivo, se a seleção for um arquivo — em **Diretório inicial** e entra nela nesta sessão. Se já houver outro diretório, o North pede confirmação antes de trocar. **Adicionar arquivo de log** inclui o arquivo na lista e abre o quadro. Um diretório não entra na lista. **Monitorar log** acompanha o caminho selecionado ao vivo, sem gravar o arquivo na conexão. Se esse caminho já está aberto, o quadro existente vem para a frente; um caminho inválido só avisa.

## Arquivos (SFTP/FTP)

Conexões SFTP e FTP abrem num navegador de arquivos com dois painéis, no estilo do WinSCP: **seu computador à esquerda** e **o servidor à direita**. Numa conexão SSH, clique com o botão direito e escolha **Abrir arquivos (SFTP)** para abrir os arquivos do mesmo servidor, com o mesmo usuário e senha. Se essa conexão tem **Diretório inicial**, o painel do servidor abre nessa pasta; o botão de home continua indo para o diretório de login. Se a pasta não puder ser aberta, o painel abre no login e um aviso explica o motivo.

No painel remoto de uma conexão SSH salva, o botão **Definir diretório padrão** fica antes do campo de caminho. Ele grava a pasta que o painel está listando como **Diretório inicial**. Se a conexão já tem um diretório, o North pede confirmação antes de trocar; cancelar não grava nada.

No painel remoto de SFTP e de FTP, **Diretórios favoritos** guarda a pasta que está aberta, só nesta conexão. Um clique volta a essa pasta. Remover só tira o caminho da lista. Outra conexão não vê esses caminhos, e eles não entram na exportação. Se a pasta não existir mais, o North avisa e continua na pasta atual. O painel local e o painel ao lado do terminal não têm essa lista.

No menu de contexto de um arquivo desse painel, **Adicionar ao monitoramento** inclui o arquivo na lista e abre o quadro. **Monitorar em tempo real** abre o quadro sem gravar o arquivo na conexão. Pasta, link, outro tipo ou mais de um item deixam os dois itens indisponíveis. O painel local e as conexões FTP não têm o botão nem esses itens.

- Arraste arquivos ou pastas de um painel para o outro para copiar. Pastas são copiadas com todo o conteúdo. Também dá para arrastar do Finder/Explorer direto para o painel do servidor.
- Atalhos no painel ativo: **F5** copia a seleção para o outro lado, **F2** renomeia, **F7** cria pasta, **Del** exclui, **Enter** abre, **Backspace** sobe uma pasta. **⌘/Ctrl+clique** e **Shift+clique** selecionam vários.
- Clique duplo num arquivo local abre no app padrão do sistema; num arquivo remoto, baixa para a pasta aberta à esquerda.
- No menu do painel remoto, **Editar** abre um arquivo de texto no editor do North. **Salvar** (ou Ctrl/Cmd+S) devolve o arquivo e substitui o que está no servidor. **Editar com…** abre um editor cadastrado em Configurações → Editores; cada gravação nesse programa também devolve o arquivo. Pasta, arquivo binário ou arquivo grande demais avisa e não abre. Fechar a aba ou a sessão apaga a cópia temporária e o envio para. **Abrir** e o clique duplo continuam só baixando.
- As colunas mostram tamanho, data, permissões (`rwxr-xr-x`) e dono; clique no cabeçalho para ordenar. A barra mostra cada pasta do caminho: clique num trecho para abrir essa pasta. O trecho final, ou a área vazia da barra, abre o campo para digitar; Enter confirma e Esc volta. No Windows, o seletor ao lado troca de unidade.
- A fila embaixo mostra cada transferência com progresso e um botão para cancelar. Cancelar interrompe na hora o arquivo em andamento e apaga a cópia parcial.
- Se algum item já existe no destino, o North pergunta antes: **Sobrescrever**, **Pular existentes** ou **Cancelar**. A escolha vale também para os arquivos dentro das pastas.
- Excluir no painel local manda para a lixeira do sistema. No servidor não existe lixeira (SFTP/FTP não têm), então a confirmação avisa que é permanente e que pastas vão com todo o conteúdo.

## Terminal local

**Terminal local**, no topo da sidebar (Visão geral) ou pela Command Palette (**⌘/Ctrl+K**), abre o shell da própria máquina — sem host, sem credencial, sem Connection cadastrada. Roda no processo main, igual às demais sessões de terminal; fechar a aba encerra o processo do shell.

## Monitoramento

No painel de detalhes de uma Conexão, a seção **Monitoramento** liga uma checagem periódica de disponibilidade (a porta TCP responde?) — não é uma sessão de verdade, não autentica, só verifica se o host está de pé, do jeito que o North já faria pra abrir a sessão. É opt-in, conexão por conexão; desligado por padrão.

Quando muda de status (subiu ou caiu), o North grava um evento no histórico (visível na própria seção e no widget **Monitoramento** do Dashboard, com todas as conexões monitoradas) e manda uma notificação nativa do sistema. Não guarda toda checagem, só as mudanças — então "3 quedas essa semana" é rápido de ler sem virar um banco gigante.

Hoje só Connections (SSH/RDP/VNC/FTP/SFTP/Telnet) são monitoráveis — Access de banco fica de fora por costumar estar atrás de VPN/firewall mais restrito, o que geraria falso alarme com frequência.

## Favoritos e abas

- Marque conexões como favoritas para acesso rápido.
- Várias abas podem ficar abertas; feche com o atalho de fechar aba.
- Duplicar aba reabre a mesma conexão em paralelo.
