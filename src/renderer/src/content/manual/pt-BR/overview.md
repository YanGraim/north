# Visão geral

O **North** é um workspace desktop para infraestrutura — não só um launcher de SSH.

Organize clientes, ambientes, conexões remotas e acessos (credenciais de banco ou login de portal) num só lugar. Sessões remotas rodam **dentro do app**: terminal, desktop e transferência de arquivos embutidos.

## O que você ganha

- Hierarquia clara: Cliente → Ambiente → Grupo → itens
- Sessões in-app sem depender de clientes externos
- Credenciais no vault local (`safeStorage` / keychain do SO)
- Workflows do grupo para ações repetíveis (deploy, restart, health-check)
- Command Palette e atalhos para ir do inventário à sessão em segundos
- Perfil local (nome e e-mail opcional) em **Configurações** — só neste computador, exibido no chip da sidebar
- Fonte do app (família e tamanho) em **Configurações → Fonte do app** — vale pra toda a interface, terminal, editores de código, hosts/portas e atalhos

## Workspaces

O botão no canto superior direito, ao lado de VPN, mostra em qual workspace você está. O **Meu workspace** fica neste computador, no banco local e no vault do sistema. No **+** ao lado de **Organizações**, informe o endereço do North Server da sua empresa e entre com o seu e-mail (o login corporativo com Entra ID chega em breve). Na organização, clientes, ambientes, grupos, conexões e tags ficam no servidor e são compartilhados com a equipe; favoritos são só seus. Nada é sincronizado entre workspaces. Você já pode conectar a partir da organização. A senha de cada conexão fica criptografada no servidor, e o North busca a senha só na hora de abrir a sessão, sem guardar cópia neste computador. Cada vez que uma senha é lida (para conectar ou colar no terminal), o servidor registra quem leu e para quê. Na organização, cada pessoa vê só os projetos (cliente, ambiente ou grupo) que um admin liberou para ela, com um de três papéis: **Admin** faz tudo e cria clientes; **Editor** cria, edita e exclui o que está dentro do projeto; **Visualizador** vê e conecta, mas não edita nem revela ou cola a senha. Os botões que você não pode usar não aparecem. Se a árvore estiver vazia, peça acesso a um admin da organização. Admins abrem o **Painel admin** pelo seletor de workspace (ou no endereço do servidor seguido de `/admin`) para adicionar pessoas, dar e tirar acesso aos projetos, desativar quem saiu e ver a auditoria. Chave privada e VPN continuam sendo de cada computador. Acessos, workflows e APIs numa organização chegam nas próximas versões. Para sair, abra o seletor e use **Sair desta organização**.
