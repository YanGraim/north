# REC-025 — VPN por pessoa na organização

- **Status:** 🧪 Em testes
- **Criado em:** 2026-11-06
- **Branch:** `fix/org-openvpn`
- **ADR:** [0018](../../adr/0018-north-server-workspaces.md)
- **Última atualização:** 2026-11-06

## Problema

Na organização, a VPN de um cliente era uma só para todos. O servidor guardava o modelo, e cada computador usava a VPN local com o mesmo gateway. Por isso:

- ninguém podia usar outro gateway para o mesmo cliente;
- a lista de VPNs era a mesma em todos os workspaces, com o campo "Cliente" apontando para clientes do Meu workspace (na organização aparecia "Sem cliente");
- não dava para usar OpenVPN, porque o `.ovpn` leva certificado e chave pessoais.

## Decisão

1. **VPNs por workspace.** `vpn_profiles.workspace_id`: cada workspace tem a sua lista neste computador. As VPNs que uma organização já usava foram copiadas para ela na migração 025, com os logins (o mesmo texto cifrado, em linhas novas do vault).
2. **Escolha por pessoa.** `organization_vpn_choices` (workspace, tipo, id, VPN) guarda qual VPN da pessoa um cliente, ambiente, conexão ou acesso usa. `NULL` quer dizer "sem VPN", e vale só para cliente e ambiente.
3. **Sugestão no servidor.** O `vpn_id` do servidor vira sugestão: a primeira escolha feita num item é publicada como modelo, só com o gateway. Quem não escolheu recebe a sugestão, mapeada para uma VPN dela com o mesmo gateway, ou para uma criada a partir do modelo sem login. Escolher outra VPN depois não muda o servidor.
4. **OpenVPN** é compartilhada só pelo endereço (`openvpnGatewayOnly`, que o servidor também aplica). Quem não tem o próprio `.ovpn` recebe o aviso para importar.
5. **Túneis independentes:** cada túnel continua no computador de cada pessoa, e ninguém desliga a VPN de outro.

## Fora do escopo

- Trocar a sugestão de um item depois de publicada. Hoje fica a primeira; um editor pode limpar o vínculo no servidor e escolher de novo.
