# REC-025 — Roteiro de testes

Pré-requisito: servidor 0.4.1 e North 0.1.53.

1. **Listas separadas:** em **VPNs**, o Meu workspace mostra as suas VPNs; na Gruppe, só as da Gruppe (as que você já usava lá aparecem copiadas, com o login).
2. **Cliente correto:** na Gruppe, a VPN Poly aparece sob o cliente Poly (não mais "Sem cliente").
3. **Escolha sua:** na Gruppe, edite um cliente e escolha uma VPN. Conecte num SSH desse cliente: a VPN sobe sozinha.
4. **Independência:** outra pessoa escolhe outra VPN (ou outro gateway) para o mesmo cliente; a sua continua igual.
5. **Sugestão:** uma pessoa nova abre um SSH do cliente: o North cria a VPN a partir da sugestão e pede só o login dela.
6. **OpenVPN:** escolha a VPN Ecofitus no cliente Ecofitus da Gruppe; quem não tem o `.ovpn` vê o aviso para importar.
7. **Desligar:** com duas pessoas conectadas à mesma VPN, uma desliga e a outra continua conectada.
8. **Meu workspace intacto:** de volta ao Meu workspace, as VPNs e os vínculos continuam como antes.
