# Connect

To open a session:

1. Select a **connection** in the list.
2. Use **Connect** (or Enter in the Command Palette).
3. The session opens in a **tab** in the workspace — terminal, desktop, files or **SQL studio**, depending on the kind.

Databases stored as Access (PostgreSQL, MySQL/MariaDB, SQL Server, SQLite) also have **Connect**. See the **SQL studio** chapter.

## Workflows (SSH)

On the **Connect** button, the split menu also lists group workflows. You can open an interactive session or start a workflow without leaving the inventory. See the **Workflows** chapter.

## Host key (SSH)

On the first SSH connection, North asks you to confirm the host key. Accept only if the fingerprint matches what you expect.

## Terminal

In a terminal session tab:

- The top bar shows `user@host`, the **environment** folder, and an **HML** / **PROD** / **DEV** badge when the name has context — the tab also carries the short label.
- The terminal follows output while you are at the bottom; if you scroll up the history, it does not jump back.
- Click on the current command line to place the cursor (no arrow keys needed). Dragging still selects text.
- **⌘A** (macOS) or **Ctrl+A** (Windows/Linux) selects the typed text on the line (not the prompt); press again to select the whole scrollback. With a selection, **Backspace** / **Delete** removes that text; **⌘X** / **Ctrl+X** cuts (copy and delete). On Mac, **Ctrl+A** still goes to the shell (beginning of line).

## Favorites and tabs

- Star connections as favorites for quick access.
- Multiple tabs can stay open; close with the close-tab shortcut.
- Duplicating a tab reopens the same connection in parallel.
