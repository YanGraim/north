# SQL studio

**Database** accesses with PostgreSQL, MySQL/MariaDB, SQL Server or SQLite open an in-app session — no separate DBeaver or Beekeeper.

## Add a connection

**New connection → Database** on the dashboard, **New → Database** in the list, or **New database** on a group opens the modal: engine, host, port, database, user, password and SSL at the end. SQLite asks for a local file.

- **Test connection** checks the login without opening the editor
- **Save and connect** stores the Access and opens the studio immediately

Redis, MongoDB and “other” stay inventory-only (copy string / reveal password).

## Connect

On the database detail panel, **Connect** opens a tab with:

- schema/table tree — click opens a data tab (`table [all]`), it does not paste SQL into the editor
- a filter bar on the table tab: a short `WHERE` or a full query; autocomplete limited to this table’s columns and filter keywords (`AND`/`NOT`/`NULL`…); **Enter** applies (**Run** lives on the right of the tab bar)
- Beekeeper-style tabs: several tables and **Query #n** (**+** opens a SQL editor; ⌘/Ctrl+Enter or **Run** in the tab bar runs the selection or the buffer)
- **Format** on the tab bar (⌘/Ctrl+Shift+F, like DBeaver) pretty-prints the query tab SQL — the selection if any, otherwise the whole buffer
- table/column autocomplete in the editor (Ctrl/⌘+Space): matches prefix and name fragments (`users` finds `log_users` and `users_companies`); the popup shows the suggested alias and kind (`Table`) in color; accepting (or Tab on the name) inserts the alias (`balances` → `balances b`)
- **Results** grid with click-to-sort and drag-to-reorder columns; clicking a table loads immediately (**100 rows** per page) and fetches more as you scroll (footer shows `100+`, then the exact total when the end is reached). Free queries still cap at 1000 rows
- click a row to select it (Shift / ⌘/Ctrl to extend); ⌘/Ctrl+C copies selected rows as TSV
- **Grid | Record** toggle on the results pane: Record shows the selected row (or the first) as field | value (selectable text), with arrows to move between rows; double-click or Enter edits a field
- on a **table** tab (not a view or free query), double-click a cell to edit (grid or record); right-click a row to **Insert**, **Duplicate**, or **Delete** (pending until save)
- **Save** / **Cancel** appear in the results footer as soon as the value changes (⌘/Ctrl+S saves); they write `UPDATE` / `INSERT` / `DELETE` when the table has a primary key
- on the session bar: **Auto-commit** switch (on by default), **Commit**, and **Rollback** — session-wide, not per tab. With auto-commit on, each statement (and grid Save) persists immediately; with it off, the next query/mutation opens a server transaction until you Commit or Rollback. Turning auto-commit back on while a transaction is open is blocked. This is separate from footer Save/Cancel (which only applies local INSERT/UPDATE/DELETE drafts)
- session header matches SSH: `user@host`, environment folder chip, and HML/PROD tint when the environment has context
- footer with row count and timing; the **Messages** tab appears only when a query fails (full database error)

The password **never** reaches the session UI — main resolves it from the vault.

## Limits in this version

- No SSH tunnel via the group’s Connection — the database host must be reachable from your machine
- No CSV export; tables without a primary key cannot be saved from the grid
- Queries time out after 30s; free-form INSERT/UPDATE/DELETE remain available as SQL
