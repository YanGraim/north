# Acessos

Acessos guardam credenciais **sem** abrir sessão remota:

- **Login** — usuário/senha e URL opcional (portal, painel)
- **Banco** — engine, host, porta, database, SSL
- **Outro** — segredo genérico com notas

## Ações no painel

- **Revelar / ocultar senha** — mostra o segredo só quando você pede
- **Copiar senha** — para colar no destino
- **Copiar connection string** — útil em acessos de banco
- **Abrir URL** — abre o link no navegador do sistema

Senhas ficam no vault do main. O renderer só recebe o valor em claro no momento do reveal consciente.
