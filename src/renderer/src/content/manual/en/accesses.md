# Accesses

Accesses store credentials **without** opening a remote session:

- **Login** — username/password and optional URL (portal, panel)
- **Database** — engine, host, port, database, SSL
- **Other** — generic secret with notes

## Panel actions

- **Reveal / hide password** — shows the secret only when you ask
- **Copy password** — paste into the destination
- **Copy connection string** — useful for database accesses
- **Open URL** — opens the link in the system browser

Passwords stay in the main-process vault. The renderer only receives plaintext at the moment of a conscious reveal.
