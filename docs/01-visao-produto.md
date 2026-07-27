# Visão do produto — North

## Identidade

**North** é um workspace desktop para profissionais de infraestrutura. Organiza clientes, ambientes, conexões remotas e acessos (credenciais de banco / login de portal) num só lugar — com a fluidez de uma ferramenta moderna e a disciplina de um inventário bem modelado.

## Conceito

> Workspace para Infraestrutura

Não é só um “gerenciador de SSH”. É o mapa operacional do dia a dia: quem é o cliente, em qual ambiente está o servidor, como conectar, com quais credenciais e o que foi feito recentemente.

## Diretriz: sessões in-app

**A experiência acontece dentro do North.** Sessões remotas (SSH, RDP, VNC, SFTP, FTP, Telnet, Serial) rodam no próprio aplicativo — terminal, desktop e transferência de arquivos embutidos — sem depender de clientes externos como caminho principal.

Abrir um cliente do SO permanece, no máximo, um **fallback transitório** (debug, protocolo ainda não suportado nativamente), nunca o objetivo do produto.

A UI conhece apenas o **tipo de sessão** (Terminal, Desktop, Arquivos), nunca o protocolo concreto. Protocolos entram via drivers no main e clientes WASM/JS no renderer.

## Valores

- **Clareza sobre volume** — hierarquia explícita (Cliente → Ambiente → Grupo → Servidor), sem pastas genéricas.
- **Velocidade com intenção** — Command Palette, favoritos e recentes; zero atrito entre “pensar” e “conectar”.
- **Sessão sem sair do app** — do inventário à sessão ativa no mesmo workspace.
- **Segurança local-first** — dados e credenciais no dispositivo; `safeStorage` / keychain do SO, não nuvem por padrão.
- **Extensível por protocolo** — SSH, RDP, VNC e futuros protocolos atrás da mesma abstração de sessão.
- **UI profissional** — dark-first, tipografia legível, layout de três painéis sem ruído visual.

## Inspirações

| Referência           | O que absorvemos                                          |
| -------------------- | --------------------------------------------------------- |
| TablePlus / DataGrip | Hierarquia clara + painéis densos e úteis                 |
| Raycast / Linear     | Command Palette e atalhos como cidadão de primeira classe |
| Termius / Royal TSX  | Inventário de conexões e sessões embutidas                |
| VS Code / electerm   | Terminal e protocolos nativos no mesmo shell              |

## Slogans / tom de voz

- “Seu norte na infraestrutura.”
- “Do inventário à sessão, sem mudar de ferramenta.”
- Tom: direto, técnico, sem hype. Preferir verbo e substantivo a adjetivos vazios.

## Público

Engenheiros de infra, SREs, consultores e times de suporte que gerenciam dezenas (ou centenas) de hosts em múltiplos clientes e ambientes.
