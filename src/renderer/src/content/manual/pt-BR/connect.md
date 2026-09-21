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

- A barra no topo mostra `usuário@host`, a pasta do **ambiente** e o badge **HML** / **PROD** / **DEV** quando o nome tem contexto — a aba também leva o rótulo curto, junto com o nome do **cliente**, pra diferenciar abas do mesmo ambiente em clientes diferentes.
- O terminal acompanha a saída enquanto você está no fim; se subir o histórico, a rolagem não puxa de volta.
- Clique na linha de comando atual para posicionar o cursor (sem precisar das setas). Arrastar continua selecionando texto.
- **⌘A** (macOS) ou **Ctrl+A** (Windows/Linux) seleciona o texto digitado na linha (não o prompt); pressione de novo para selecionar todo o histórico. Com a seleção ativa, **Backspace** / **Delete** apaga esse texto; **⌘X** / **Ctrl+X** corta (copia e apaga). No Mac, **Ctrl+A** segue indo ao shell (início da linha).
- O menu de contexto (botão direito) tem **Colar senha salva** quando a conexão tem senha ou senha de sudo salva — cola a senha guardada no vault direto no terminal (útil para `sudo su` e afins), sem passar pelo clipboard do sistema.
- Colar uma imagem (⌘V/Ctrl+V com uma imagem copiada, por exemplo um screenshot) salva ela num arquivo temporário e cola o caminho como texto — do jeito que iTerm2/Terminal.app fazem. Útil pra mandar uma imagem pra CLIs de agente (Claude Code e similares) rodando no terminal.

## Terminal local

A Command Palette (**⌘/Ctrl+K**) tem um item **Terminal local** que abre o shell da própria máquina — sem host, sem credencial, sem Connection cadastrada. Roda no processo main, igual às demais sessões de terminal; fechar a aba encerra o processo do shell.

## Favoritos e abas

- Marque conexões como favoritas para acesso rápido.
- Várias abas podem ficar abertas; feche com o atalho de fechar aba.
- Duplicar aba reabre a mesma conexão em paralelo.
