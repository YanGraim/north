# Estúdio SQL

Acessos de **banco** com PostgreSQL, MySQL/MariaDB, SQL Server ou SQLite abrem uma sessão in-app — sem DBeaver ou Beekeeper à parte.

## Cadastrar

Em **Nova conexão → Banco** no dashboard, **Novo → Banco** na lista, ou **Novo banco** no grupo, abre o modal: engine, host, porta, database, usuário, senha e SSL no final. SQLite pede o arquivo local.

- **Testar conexão** valida o acesso sem abrir o editor
- **Salvar e conectar** grava o Access e abre o estúdio na hora

Redis, MongoDB e “outro” continuam só inventário (copiar string / revelar senha).

## Conectar

No painel do banco, **Conectar** abre uma aba com:

- árvore de schemas e tabelas — o clique abre uma aba de dados (`tabela [all]`), não cola SQL no editor
- barra de filtro no topo da aba da tabela: `WHERE` curto ou uma query completa; autocomplete só das colunas da tabela e keywords de filtro (`AND`/`NOT`/`NULL`…); **Enter** aplica (o **Executar** fica na barra de abas, à direita)
- abas estilo Beekeeper: várias tabelas e **Query #n** (o **+** abre um editor SQL; ⌘/Ctrl+Enter ou **Executar** na barra de abas roda a seleção ou o buffer)
- **Formatar** na barra de abas (⌘/Ctrl+Shift+F, como no DBeaver) organiza o SQL da aba de query — a seleção, se houver; senão o buffer inteiro
- autocomplete de tabelas/colunas no editor (Ctrl/⌘+Space): filtra por prefixo e por trecho do nome (`users` acha `log_users` e `users_companies`); o popup mostra o alias sugerido e o tipo (`Table`) com cores; ao aceitar (ou Tab no nome), insere o alias (`balances` → `balances b`)
- grid em **Resultados** com ordenação ao clicar no cabeçalho e arrastar para reordenar colunas; o clique na tabela carrega na hora (**100 linhas** por página) e busca mais ao rolar (rodapé mostra `100+`, depois o total exato no fim). Query livre continua com teto de 1000 linhas
- clique na linha para selecionar (Shift / ⌘/Ctrl para estender); ⌘/Ctrl+C copia as linhas selecionadas em TSV
- toggle **Grade | Registro** no painel de resultados: Registro mostra a linha selecionada (ou a primeira) como campo | valor (texto selecionável), com setas para navegar; duplo clique ou Enter edita o campo
- na aba de **tabela** (não view nem query livre), duplo clique edita a célula (grade ou registro); botão direito na linha para **Inserir**, **Duplicar** ou **Excluir** (pendente até salvar)
- **Salvar** / **Cancelar** aparecem no rodapé dos resultados assim que o valor muda (⌘/Ctrl+S salva); gravam `UPDATE` / `INSERT` / `DELETE` quando a tabela tem chave primária
- na barra da sessão: switch **Auto-commit** (ligado por padrão), **Commit** e **Rollback** — vale para a sessão inteira, não por aba. Com auto-commit ligado, cada statement (e o Salvar do grid) persiste na hora; desligado, a próxima query/mutação abre uma transação no servidor até você dar Commit ou Rollback. Religar o auto-commit com transação aberta fica bloqueado. Isso é distinto do Salvar/Cancelar do rodapé (que só aplica INSERT/UPDATE/DELETE locais)
- cabeçalho da sessão igual ao SSH: `usuário@host`, pasta do ambiente e tinta HML/PROD quando o ambiente tem contexto
- rodapé com linhas e tempo; a aba **Mensagens** só aparece se a query falhar (erro completo do banco)

A senha **não** vai para a UI da sessão — o main resolve no vault.

## Limites desta versão

- Sem túnel SSH pela Connection do grupo — o host do banco precisa estar alcançável da sua máquina
- Sem export CSV; tabelas sem chave primária não salvam pelo grid
- Queries têm timeout de 30s; INSERT/UPDATE/DELETE livres continuam disponíveis como SQL
