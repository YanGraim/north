## VPN de cada um na organização

- **Cada um com a sua VPN, no mesmo workspace:** na organização, a tela VPNs mostra só as VPNs que você usa nela, e a VPN de cada cliente é escolha sua: outra pessoa pode usar outro gateway ou outro login sem mudar a sua, e desligar a sua VPN não derruba a de ninguém. A primeira escolha vira sugestão para quem chega depois
- **OpenVPN no cliente e no ambiente:** agora dá para escolher uma VPN OpenVPN no cliente ou no ambiente da organização. O servidor guarda só o endereço da VPN; o certificado e a chave do seu `.ovpn` não saem do seu computador
- **Cada um com o seu .ovpn:** quem tem o próprio `.ovpn` importado no North conecta sozinho; quem ainda não tem recebe o aviso para importar
- **Erro ao salvar a VPN:** se não der para salvar a VPN de um cliente ou ambiente, o North agora mostra o motivo em vez de não fazer nada

Veja o capítulo [VPNs](vpns) no manual.
