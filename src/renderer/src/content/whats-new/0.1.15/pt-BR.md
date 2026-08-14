## Estúdio SQL

Conecte em PostgreSQL, MySQL/MariaDB, SQL Server e SQLite a partir do Access de banco.

- Modal de conexão com host, porta, usuário, senha e **Testar**
- **Conectar** abre o estúdio: árvore, abas de tabela/query, barra de filtro e grid com ordenação e colunas arrastáveis
- **Executar** na barra de abas; rodapé com linhas/tempo (`100+` enquanto há mais páginas na aba de tabela); **Mensagens** só quando a query falha
- Autocomplete SQL com alias ao aceitar tabela (Tab também expande `balances` → `balances b`); popup com cores (tabela / alias / tipo) e filtro por trecho do nome
- Selecione linhas no grid (Shift / ⌘/Ctrl), copie em TSV; edite células nas abas de tabela — **Salvar** / **Cancelar** aparecem no rodapé assim que o valor muda (⌘/Ctrl+S)
- Botão direito na linha para inserir, duplicar ou marcar exclusão; visão Registro permite selecionar e editar valores
- Cabeçalho da sessão com `usuário@host` e ambiente (tinta HML/PROD), como no SSH
- Clique na tabela carrega na hora; abas de tabela buscam mais linhas ao rolar (páginas de 100)
- **Auto-commit**, **Commit** e **Rollback** na barra da sessão (transação no servidor; distinto do Salvar do grid)
- **Formatar** SQL na aba de query (⌘/Ctrl+Shift+F)
