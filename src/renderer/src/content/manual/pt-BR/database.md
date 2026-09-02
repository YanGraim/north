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
- abas estilo Beekeeper: várias tabelas e **Query #n** (o **+** abre um editor SQL; ⌘/Ctrl+Enter ou **Executar** na barra de abas roda a **seleção**, ou o statement sob o cursor separado por `;` — não o arquivo inteiro se houver várias queries)
- **Formatar** na barra de abas (⌘/Ctrl+Shift+F, como no DBeaver) organiza o SQL da aba de query — a seleção, se houver; senão o buffer inteiro
- autocomplete de tabelas/colunas no editor (Ctrl/⌘+Space): filtra por prefixo e por trecho do nome (`users` acha `log_users` e `users_companies`); o popup mostra o alias sugerido e o tipo (`Table`) com cores; ao aceitar (ou Tab no nome), insere o alias (`balances` → `balances b`)
- grade em **Resultados** com fonte 13px: clique no **nome** do cabeçalho seleciona a coluna inteira (Shift / ⌘/Ctrl para intervalo ou soma/tira); arraste nas **células** (cima/baixo ou um retângulo) para só alguns valores; o **ícone** cicla a ordenação; arraste o cabeçalho para reordenar; arraste a **borda direita** do cabeçalho para mudar a largura (duplo clique na borda ajusta ao conteúdo visível). O clique na tabela carrega na hora (**100 linhas** por página) e busca mais ao rolar (rodapé mostra `100+`; **clique no contador** para saber o total no servidor, estilo DBeaver, sem rolar até o fim). A aba Query pagina da mesma forma os `SELECT`/`WITH` sem `LIMIT`/`TOP`/`FETCH`; o SQL original permanece no editor (Salvar não usa o `OFFSET`)
- clique no `#` para selecionar linhas (Shift / ⌘/Ctrl / arraste); ⌘/Ctrl+C copia TSV — linhas (todas as colunas visíveis), coluna inteira, ou só as células do intervalo
- **Exportar** no painel de resultados (⌘/Ctrl+Shift+E) ou botão direito na grade: diálogo com origem (**Seleção** = mesma fatia do ⌘/Ctrl+C, incluindo rascunho; **Visível** = linhas carregadas na grade; **Query/tabela completa** = reexecuta no servidor), formatos CSV, JSON, Excel, PDF e SQL INSERT; query completa até **100 mil** linhas (PDF **5 mil**)
- com coluna(s) ou um intervalo de células selecionados, a **Soma** no rodapé totaliza os números visíveis na hora (pula NULL e texto não numérico; inclui `numeric`/`decimal`/`bigint` e edição pendente). Clique no total para copiar; ele fica ao lado da contagem de linhas até você mudar a seleção
- toggle **Grade | Registro** no painel de resultados: Registro mostra a linha selecionada (ou a primeira) como campo | valor (texto selecionável), com setas para navegar; duplo clique, F2 ou Enter edita o campo
- em qualquer result set (tabela, query livre, JOIN ou view), duplo clique, **F2** ou **Enter** abre o editor da célula; clique simples continua selecionando a linha. Colunas `CHAR`/`VARCHAR` respeitam o comprimento do schema (ainda dá para digitar `NULL` em campos anuláveis). Inserir / Duplicar / Excluir (botão direito) só na aba de **tabela** que não é view — **Duplicar** coloca a cópia logo abaixo da origem; **Definir NULL** zera as células selecionadas (ou a do foco)
- **Salvar** / **Cancelar** aparecem no rodapé assim que o valor muda (⌘/Ctrl+S salva — e impede o “salvar página” do Chromium no estúdio). Salvar executa `UPDATE` de verdade: na aba de tabela, na própria relação; na query livre, na primeira tabela do `FROM` (com JOIN, não nas tabelas do JOIN), inclusive no SQL Server (`TOP`, `[dbo].[tabela]`, `WITH (NOLOCK)` e literais `bit` 1/0). É preciso ter chave primária no result set; `DISTINCT` / `GROUP BY` / `UNION` / `WITH` não gravam (o resultado não mapeia 1:1). Auto-commit da sessão continua valendo
- **UPDATE** / **DELETE** sem `WHERE` no statement principal (não conta o `WHERE` de subquery) pedem confirmação antes de executar, na Query e no filtro SQL da tabela
- na barra da sessão: switch **Auto-commit** (ligado por padrão), **Commit** e **Rollback** — vale para a sessão inteira, não por aba. Com auto-commit ligado, cada statement (e o Salvar do grid) persiste na hora; desligado, a próxima query/mutação abre uma transação no servidor até você dar Commit ou Rollback. Religar o auto-commit com transação aberta fica bloqueado. Isso é distinto do Salvar/Cancelar do rodapé (que monta o `UPDATE`/`INSERT`/`DELETE` a partir das edições da grade)
- cabeçalho da sessão igual ao SSH: `usuário@host`, pasta do ambiente e badge HML/PROD quando o ambiente tem contexto
- rodapé com linhas e tempo; a aba **Mensagens** só aparece se a query falhar (erro completo do banco) — selecione o texto ou use **Copiar**

A senha **não** vai para a UI da sessão — o main resolve no vault.

## Limites desta versão

- Sem túnel SSH pela Connection do grupo — o host do banco precisa estar alcançável da sua máquina
- Tabelas sem chave primária não salvam pelo grid
- Queries têm timeout de 30s; INSERT/UPDATE/DELETE livres continuam disponíveis como SQL
