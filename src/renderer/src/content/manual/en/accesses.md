# Accesses

Accesses store credentials in the same Client → Environment → Group hierarchy:

- **Login** — username/password and URL (portal, panel) — **no** remote session
- **Database** — engine, host, port, database, SSL. PostgreSQL, MySQL/MariaDB, SQL Server and SQLite open the [SQL studio](database); the UI shows the **engine brand** (unless a custom icon is set)
- **Other** — generic secret with notes

## Panel actions

- **Connect** — only for supported database engines; opens the in-app editor
- **Reveal / hide password** — shows the secret only when you ask
- **Copy password** — paste into the destination
- **Copy connection string** — useful for database accesses
- **Open URL** — opens the link in the system browser

Passwords stay in the main-process vault. The renderer only receives plaintext at the moment of a conscious reveal.
