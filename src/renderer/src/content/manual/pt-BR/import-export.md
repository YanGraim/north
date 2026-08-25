# Importar / exportar e atualizações

## Inventário em JSON

Em **Configurações → Inventário**:

- **Exportar JSON** — backup do inventário (schemaVersion 2: clientes → ambientes → grupos → conexões **e accesses** + tags)
- **Importar JSON** — restaura a partir de um JSON exportado (aceita v1 e v2)

O JSON **não inclui credenciais/segredos**. Após importar, reconfigure senhas e chaves no vault.

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
