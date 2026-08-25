## Atualizações no Mac

- Auto-update de novo usa um certificado **estável** (não ad-hoc). Quem está no **0.1.16 ou anterior** precisa instalar este `.dmg` **uma vez**; as próximas versões entram pelo próprio app.
- O release no GitHub precisa estar **publicado** — rascunho não aparece no verificador.
- A primeira abertura ainda pode pedir clique direito → Abrir (o certificado não é da Apple).

Veja [Importar / exportar](import-export).

## Sessão e janela

- **Ambiente na sessão** — a barra e a aba mostram **HML** / **PROD** / **DEV** (e o nome) para não misturar homologação com produção.
- **Titlebar no Windows** — a versão não encosta nos botões minimizar / maximizar / fechar.
- **Terminal acompanha a saída** — o scroll desce sozinho no fim; se você subir o histórico, não puxa de volta.
- **Duração** no dashboard, histórico e workflows (`512 ms`, `4m 12s`).

Veja [Conectar](connect).

## Grade SQL

- **Executar** e ⌘/Ctrl+Enter rodam a seleção ou o statement sob o cursor (não o buffer inteiro).
- **Query em páginas de 100** — `SELECT`/`WITH` carregam 100 linhas e pedem mais ao rolar, como a aba da tabela.
- **Duplicar** insere a cópia abaixo da linha; **Definir NULL** no menu de contexto; colunas `CHAR` respeitam o tamanho.
- **Redimensionar colunas** — arraste a borda do cabeçalho; duplo clique ajusta ao conteúdo.
- **Aviso** antes de `UPDATE`/`DELETE` sem `WHERE` no statement principal.
- **Editar em qualquer resultado** também no SQL Server.

Veja [Estúdio SQL](database).
