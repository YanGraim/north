## SQL studio

Connect to PostgreSQL, MySQL/MariaDB, SQL Server and SQLite from a database Access.

- Connection modal with host, port, user, password and **Test**
- **Connect** opens the studio: tree, table/query tabs, filter bar, and a grid with sorting and draggable columns
- **Run** on the tab bar; footer with rows/timing (`100+` while more table pages remain); **Messages** only when a query fails
- SQL autocomplete with table aliases on accept (Tab also expands `balances` → `balances b`); colored popup (table / alias / kind) and substring table filter
- Select rows in the grid (Shift / ⌘/Ctrl), copy as TSV; edit cells on table tabs — **Save** / **Cancel** appear in the footer as soon as the value changes (⌘/Ctrl+S)
- Right-click a table row to insert, duplicate, or mark for delete; Record view lets you select and edit field values
- Session header shows `user@host` and environment (HML/PROD tint), like SSH
- Clicking a table loads immediately; table tabs fetch more rows as you scroll (100-row pages)
- **Auto-commit**, **Commit**, and **Rollback** on the session bar (server transaction; separate from grid Save)
- **Format** SQL on a query tab (⌘/Ctrl+Shift+F)
