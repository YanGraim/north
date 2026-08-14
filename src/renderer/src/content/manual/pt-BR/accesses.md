# Acessos

Acessos guardam credenciais na mesma hierarquia Cliente → Ambiente → Grupo:

- **Login** — usuário/senha e URL (portal, painel) — **sem** sessão remota
- **Banco** — engine, host, porta, database, SSL. PostgreSQL, MySQL/MariaDB, SQL Server e SQLite abrem o [estúdio SQL](database)
- **Outro** — segredo genérico com notas

## Ações no painel

- **Conectar** — só em bancos com engine suportado; abre o editor in-app
- **Revelar / ocultar senha** — mostra o segredo só quando você pede
- **Copiar senha** — para colar no destino
- **Copiar connection string** — útil em acessos de banco
- **Abrir URL** — abre o link no navegador do sistema

Senhas ficam no vault do main. O renderer só recebe o valor em claro no momento do reveal consciente.
