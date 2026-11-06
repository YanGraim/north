## Workflows na organização

- **Workflows para a equipe:** os workflows e as variáveis do grupo agora ficam na organização. Quem vê o grupo roda; Editor e Admin mudam
- **VPN liga sozinha no workflow:** se o cliente usa VPN, ela sobe antes do primeiro passo e desliga no fim, no Meu workspace e na organização
- **Quem atualizou:** em Últimas atualizações aparece quem rodou cada workflow com rastreamento Git
- **Cópia completa:** Copiar para workspace e Copiar do Meu workspace levam também os workflows e as variáveis
- **Suas equipes:** em Configurações, veja seu papel e de quais equipes você faz parte
- **Painel admin:** marque vários itens (ou todos os clientes) e libere de uma vez
- **Correção:** um workflow que não conseguia conectar ficava "rodando" para sempre; agora termina como falha e mostra o erro
- **Agente SSH no workflow:** conexões com "Encaminhar agente SSH" agora levam o agente para os passos do workflow, como no terminal (ex.: `git pull` com a sua chave)
- **OpenVPN no Windows:** corrige a conexão em notebooks de empresa (conta de domínio ou Entra ID) e quando o OpenVPN já estava instalado; se o OpenVPN encerrar antes de conectar, o log da VPN agora mostra o motivo

Veja o capítulo [Workflows](workflows) no manual.
