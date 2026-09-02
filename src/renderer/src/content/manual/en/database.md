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
- Beekeeper-style tabs: several tables and **Query #n** (**+** opens a SQL editor; ⌘/Ctrl+Enter or **Run** in the tab bar runs the **selection**, or the statement under the cursor split by `;` — not the whole buffer when there are several queries)
- **Format** on the tab bar (⌘/Ctrl+Shift+F, like DBeaver) pretty-prints the query tab SQL — the selection if any, otherwise the whole buffer
- table/column autocomplete in the editor (Ctrl/⌘+Space): matches prefix and name fragments (`users` finds `log_users` and `users_companies`); the popup shows the suggested alias and kind (`Table`) in color; accepting (or Tab on the name) inserts the alias (`balances` → `balances b`)
- **Results** grid at 13px: click the header **name** to select the whole column (Shift / ⌘/Ctrl for range or toggle); drag **cells** (up/down or a rectangle) for just some values; the **icon** cycles sort; drag the header to reorder; drag the header **right edge** to resize (double-click the edge auto-fits visible content). Clicking a table loads immediately (**100 rows** per page) and fetches more as you scroll (footer shows `100+`; **click the counter** to fetch the server total, DBeaver-style, without scrolling to the end). The Query tab pages `SELECT`/`WITH` the same way when there is no `LIMIT`/`TOP`/`FETCH`; the original SQL stays in the editor (Save never uses the `OFFSET` form)
- click `#` to select rows (Shift / ⌘/Ctrl / drag); ⌘/Ctrl+C copies TSV — rows (all visible columns), a whole column, or only the cells in the range
- **Export** on the results pane (⌘/Ctrl+Shift+E) or right-click the grid: dialog with source (**Selection** = same slice as ⌘/Ctrl+C, including draft edits; **Visible** = rows loaded in the grid; **Full query/table** = re-runs on the server), formats CSV, JSON, Excel, PDF and SQL INSERT; full query up to **100k** rows (PDF **5k**)
- with column(s) or a cell range selected, **Sum** in the footer totals visible numbers immediately (skips NULL and non-numeric text; includes `numeric`/`decimal`/`bigint` and pending edits). Click the total to copy; it stays next to the row count until the selection changes
- **Grid | Record** toggle on the results pane: Record shows the selected row (or the first) as field | value (selectable text), with arrows to move between rows; double-click, F2 or Enter edits a field
- on any result set (table, free query, JOIN or view), double-click, **F2** or **Enter** opens the cell editor; a single click still selects the row. `CHAR`/`VARCHAR` columns honor schema length (you can still type `NULL` on nullable fields). Insert / Duplicate / Delete (right-click) only on a **table** tab that is not a view — **Duplicate** places the copy right below the source; **Set NULL** clears the selected cells (or the focused one)
- **Save** / **Cancel** appear in the footer as soon as the value changes (⌘/Ctrl+S saves — and stops Chromium’s “save page” while the studio is visible). Save runs a real `UPDATE`: on a table tab, against that relation; on a free query, against the first `FROM` table (with JOIN, not the joined tables), including SQL Server (`TOP`, `[dbo].[table]`, `WITH (NOLOCK)`, and `bit` 1/0 literals). The primary key must be in the result set; `DISTINCT` / `GROUP BY` / `UNION` / `WITH` cannot be saved (the result is not 1:1). Session auto-commit still applies
- **UPDATE** / **DELETE** with no top-level `WHERE` (subquery `WHERE` does not count) ask for confirmation before running, on Query and on the table SQL filter
- on the session bar: **Auto-commit** switch (on by default), **Commit**, and **Rollback** — session-wide, not per tab. With auto-commit on, each statement (and grid Save) persists immediately; with it off, the next query/mutation opens a server transaction until you Commit or Rollback. Turning auto-commit back on while a transaction is open is blocked. This is separate from footer Save/Cancel (which builds `UPDATE` / `INSERT` / `DELETE` from the grid edits)
- session header matches SSH: `user@host`, environment folder chip, and HML/PROD badge when the environment has context
- footer with row count and timing; the **Messages** tab appears only when a query fails (full database error) — select the text or use **Copy**

The password **never** reaches the session UI — main resolves it from the vault.

## Limits in this version

- No SSH tunnel via the group’s Connection — the database host must be reachable from your machine
- Tables without a primary key cannot be saved from the grid
- Queries time out after 30s; free-form INSERT/UPDATE/DELETE remain available as SQL
