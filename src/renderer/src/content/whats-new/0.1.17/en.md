## Mac updates

- In-app updates again use a **stable** certificate (not ad-hoc). If you are on **0.1.16 or older**, install this `.dmg` **once**; later versions arrive from the app itself.
- The GitHub release must be **published** — drafts do not show up in the checker.
- The first open may still ask for Right-click → Open (the certificate is not from Apple).

See [Import / export](import-export).

## Session and window

- **Environment on the session** — the bar and tab show **HML** / **PROD** / **DEV** (and the name) so staging is not mistaken for production.
- **Windows titlebar** — the version no longer sits under the minimize / maximize / close buttons.
- **Terminal follows output** — scroll stays at the bottom; if you move up the history, it does not jump back.
- **Duration** on the dashboard, history and workflows (`512 ms`, `4m 12s`).

See [Connect](connect).

## SQL grid

- **Run** and ⌘/Ctrl+Enter execute the selection or the statement under the cursor (not the whole buffer).
- **Query pages of 100** — `SELECT`/`WITH` load 100 rows and fetch more as you scroll, like the table tab.
- **Duplicate** inserts the copy right below the row; **Set NULL** in the context menu; `CHAR` columns honor length.
- **Resize columns** — drag the header edge; double-click auto-fits content.
- **Warning** before `UPDATE`/`DELETE` with no top-level `WHERE`.
- **Edit in any result** also works on SQL Server.

See [SQL studio](database).
