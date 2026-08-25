# Conectar

Para abrir uma sessão:

1. Selecione uma **conexão** na lista.
2. Use **Conectar** (ou Enter na Command Palette).
3. A sessão abre em uma **aba** no workspace — terminal, desktop, arquivos ou **estúdio SQL**, conforme o tipo.

Bancos cadastrados como Access (PostgreSQL, MySQL/MariaDB, SQL Server, SQLite) também têm **Conectar**. Detalhes no capítulo **Estúdio SQL**.

## Workflows (SSH)

No botão **Conectar**, o menu split também lista workflows do grupo. Você pode abrir a sessão interativa ou disparar um workflow sem sair do inventário. Detalhes no capítulo **Workflows**.

## Host key (SSH)

Na primeira conexão SSH, o North pede confirmação da chave do host. Aceite só se o fingerprint bater com o esperado.

## Terminal

Na aba de sessão terminal:

- A barra no topo mostra `usuário@host`, a pasta do **ambiente** e o badge **HML** / **PROD** / **DEV** quando o nome tem contexto — a aba também leva o rótulo curto.
- O terminal acompanha a saída enquanto você está no fim; se subir o histórico, a rolagem não puxa de volta.
- Clique na linha de comando atual para posicionar o cursor (sem precisar das setas). Arrastar continua selecionando texto.
- **⌘A** (macOS) ou **Ctrl+A** (Windows/Linux) seleciona o texto digitado na linha (não o prompt); pressione de novo para selecionar todo o histórico. Com a seleção ativa, **Backspace** / **Delete** apaga esse texto; **⌘X** / **Ctrl+X** corta (copia e apaga). No Mac, **Ctrl+A** segue indo ao shell (início da linha).

## Favoritos e abas

- Marque conexões como favoritas para acesso rápido.
- Várias abas podem ficar abertas; feche com o atalho de fechar aba.
- Duplicar aba reabre a mesma conexão em paralelo.
