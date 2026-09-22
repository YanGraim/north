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

- The top bar shows `user@host`, the **environment** folder, and an **HML** / **PROD** / **DEV** badge when the name has context — the tab also carries the short label, together with the **client** name, to tell apart tabs from the same environment across different clients.
- The terminal follows output while you are at the bottom; if you scroll up the history, it does not jump back.
- Click on the current command line to place the cursor (no arrow keys needed). Dragging still selects text.
- **⌘A** (macOS) or **Ctrl+A** (Windows/Linux) selects the typed text on the line (not the prompt); press again to select the whole scrollback. With a selection, **Backspace** / **Delete** removes that text; **⌘X** / **Ctrl+X** cuts (copy and delete). On Mac, **Ctrl+A** still goes to the shell (beginning of line).
- The right-click menu has **Paste saved password** when the connection has a stored password or sudo password — it pastes the vault-stored secret directly into the terminal (handy for `sudo su` and similar), without ever going through the OS clipboard.
- Pasting an image (⌘V/Ctrl+V with an image on the clipboard, e.g. a screenshot) saves it to a temp file and pastes the path as text — the same way iTerm2/Terminal.app do it. Handy for sending an image to agent CLIs (Claude Code and similar) running in the terminal.

## Local terminal

**Local terminal**, at the top of the sidebar (Overview) or via the Command Palette (**⌘/Ctrl+K**), opens a shell on your own machine — no host, no credential, no saved Connection. It runs in the main process, just like other terminal sessions; closing the tab ends the shell process.

## Monitoring

On a Connection's details panel, the **Monitoring** section turns on a periodic availability check (does the TCP port respond?) — not a real session, no authentication, just whether the host is up, the same way North would reach it to open a session. It's opt-in, per connection; off by default.

When the status changes (came up or went down), North records an event in the history (visible in the section itself and in the Dashboard's **Monitoring** widget, across every monitored connection) and sends a native system notification. It doesn't store every check, only the changes — so "3 outages this week" stays fast to read without turning into a huge database.

Today only Connections (SSH/RDP/VNC/FTP/SFTP/Telnet) can be monitored — database Access is left out since it's usually behind a more restrictive VPN/firewall, which would trigger false alarms often.

## Favorites and tabs

- Star connections as favorites for quick access.
- Multiple tabs can stay open; close with the close-tab shortcut.
- Duplicating a tab reopens the same connection in parallel.
