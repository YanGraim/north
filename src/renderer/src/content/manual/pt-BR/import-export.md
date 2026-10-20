# Importar / exportar e atualizações

## Inventário em JSON

Em **Configurações → Inventário**:

- **Exportar JSON** — backup do inventário: clientes → ambientes → grupos → conexões e accesses, com os **workflows** e as **variáveis** de cada grupo, as tags e as **VPNs FortiGate** (SSL-VPN e IPsec), incluindo qual VPN cada cliente, ambiente e conexão usa
- **Importar JSON** — traz um JSON exportado (de qualquer versão do North) para este North. O que já existe com o mesmo nome fica como está; só entra o que falta

O JSON **não inclui credenciais/segredos**. Após importar, reconfigure senhas e chaves no vault. Nas VPNs, nem o **usuário** vai no arquivo (é pessoal): ao conectar uma VPN importada, o North pede para preencher seu usuário em **Editar**, e a senha/PSK na primeira conexão. VPNs **OpenVPN** não entram no arquivo, porque cada pessoa tem o próprio `.ovpn`: importe o seu na tela de VPNs.

## Planilha CSV

- **Baixar modelo CSV** — salva `north-acessos-modelo.csv` para preencher no Excel/Sheets
- **Importar planilha (CSV)** — linhas com `tipo` = `servidor` | `banco` | `login`

Colunas principais: `cliente`, `ambiente`, `grupo`, `nome`, `protocolo`/`engine`, `host`, `porta`, `database`, `url`, `usuario`, `senha`, `notas`, `tags`.

Se o CSV tiver senhas, a UI pede confirmação explícita antes de gravá-las no vault. Sem confirmação, as senhas são ignoradas.

## Atualizações

Em **Configurações → Atualizações**, verifique novas versões via GitHub Releases. Em builds de desenvolvimento o updater costuma ficar desligado.

**macOS — primeira instalação:** o `.dmg` não é da Apple; o Gatekeeper pode pedir clique direito → Abrir. Copie o North para **Aplicativos** antes de usar atualizações in-app.

**Se você veio da 0.1.16 ou anterior:** instale este `.dmg` **uma vez**. Builds antigas (ad-hoc) não aceitam o zip novo. Depois disso, **Verificar agora** → **Instalar e reiniciar**.

**Atualizações seguintes:** o release no GitHub precisa estar **publicado** (rascunho/draft não aparece para o updater).
