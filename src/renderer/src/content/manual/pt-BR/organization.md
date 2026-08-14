# Organização

O inventário segue uma hierarquia explícita:

1. **Cliente** — empresa ou conta que você atende
2. **Ambiente** — produção, staging, lab, etc.
3. **Grupo** — agrupamento lógico (região, stack, time)
4. **Itens** — conexões e acessos dentro do grupo

## Conexões vs acessos

| Tipo | Para quê |
| --- | --- |
| **Conexão** | Servidor remoto com sessão (SSH, RDP, VNC, SFTP, FTP, Telnet, Serial) |
| **Acesso** | Credencial de banco, login de portal ou outro segredo — **sem** sessão remota |

Pense em conexões como “como entro no host” e acessos como “o que uso para autenticar em serviços”.

## Workflows

O **grupo** é o dono dos workflows e das variáveis de projeto. A execução aponta para uma conexão (alvo); credenciais nunca ficam no workflow — só na bolsa de secrets da conexão.
