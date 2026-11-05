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

## SSH agent (git on the server)

To run `git pull`/`git push` on a server with the key from **your** computer (without copying it there), turn on **Forward SSH agent (ssh -A)** on the connection. It works like `ssh -A` in a terminal and is off by default.

1. Load the key into your local agent: `ssh-add ~/.ssh/id_ed25519`. On Windows, the **OpenSSH Authentication Agent** service must be enabled.
2. Turn the option on for the connection and connect.
3. On the server, test with `ssh -T git@your-gitlab` (or the command your GitLab tells you).

Only turn it on for trusted servers: anyone with root on the server can use the agent while the session is open. If the agent isn't running or the server blocks forwarding, the session still opens, just without the agent, and North prints a yellow notice in the terminal saying why.

## Terminal

In a terminal session tab:

- The top bar shows `user@host`, the **environment** folder, and an **HML** / **PROD** / **DEV** badge when the name has context — the tab also carries the short label, together with the **client** name, to tell apart tabs from the same environment across different clients.
- The terminal follows output while you are at the bottom; if you scroll up the history, it does not jump back.
- Click on the current command line to place the cursor (no arrow keys needed). Dragging still selects text.
- The middle button copies the selected text and clears the selection. With no selection, it pastes the clipboard, including an image, which becomes a file path. The right button still opens the menu.
- In **Settings**, under **Terminal**, **Right button copies or pastes** swaps those roles. It starts off. When on, the right button copies or pastes and the middle button opens the same menu. Outside the terminal, the buttons do not change.
- **⌘A** (macOS) or **Ctrl+A** (Windows/Linux) selects the typed text on the line (not the prompt); press again to select the whole scrollback. With a selection, **Backspace** / **Delete** removes that text; **⌘X** / **Ctrl+X** cuts (copy and delete). On Mac, **Ctrl+A** still goes to the shell (beginning of line).
- The right-click menu has **Paste saved password** when the connection has a stored password or sudo password — it pastes the vault-stored secret directly into the terminal (handy for `sudo su` and similar), without ever going through the OS clipboard.
- Pasting an image (⌘V/Ctrl+V with an image on the clipboard, e.g. a screenshot) saves it to a temp file and pastes the path as text — the same way iTerm2/Terminal.app do it. Handy for sending an image to agent CLIs (Claude Code and similar) running in the terminal.
- If the SSH connection has an **Initial directory**, the shell opens in that folder (`/var/www` or `~/app`). Without it, the shell opens in the login directory, as before. If the folder does not exist or cannot be entered, the session stays in the login directory and a yellow `[North]` line says why.
- On the SSH terminal of a saved connection, the **Files** badge sits beside the environment (or the folder chip, when there is no environment) and opens a panel to the right of the terminal with the files in the shell's current folder. North reads that folder from this session's bash and zsh prompt; a `cd` updates the list. Opening a folder, going up, going to the login folder, or clicking a path segment writes `cd` in the shell. The list changes only when the prompt confirms the folder. If the line already has text, the `cd` waits. Download asks for a destination folder. Upload, open, create, rename, and delete work here, as do saving the startup directory and following a log. Refresh only re-reads the same folder. Until the folder arrives, the panel explains that and does not show the login directory instead. Closing the badge hides the panel. The local shell, Telnet, serial, agent workspace, workflows, FTP, RDP, and the file browser do not show this badge.
- Under **Log files**, each path (`/var/log/app.log` or `~/app/app.log`) gets a panel that follows the file and keeps going after it rotates. **Follow** opens the panel in the strip at the bottom. **Pop out** moves it to a window that stays visible when the main window is minimized. Closing the panel or the app ends the follow. With no files, nothing changes.
- In the SSH terminal context menu, **Set default directory** saves the selected folder — or the file's folder, when the selection is a file — as the **Initial directory** and enters it in this session. If another directory is already set, North asks before replacing it. **Add log file** adds the file to the list and opens the panel. A directory is not added. **Follow log** follows the selected path live without saving the file on the connection. If that path is already open, the existing panel comes forward; an invalid path only shows a warning.

## Files (SFTP/FTP)

SFTP and FTP connections open in a two-pane file browser, WinSCP style: **your computer on the left** and **the server on the right**. On an SSH connection, right-click and choose **Open files (SFTP)** to browse the same server with the same user and password. If that connection has an **Initial directory**, the server pane opens there; the home button still goes to the login directory. If the folder cannot be opened, the pane opens in the login directory and a notice explains why.

On the remote pane of a saved SSH connection, the **Set default directory** button sits before the path field. It saves the folder the pane is listing as the **Initial directory**. If the connection already has a directory, North asks before replacing it; cancelling writes nothing.

On the remote pane of SFTP and FTP, **Favorite directories** saves the folder that is open, for this connection only. A click returns to that folder. Remove only takes the path off the list. Another connection does not see these paths, and they are not part of an export. If the folder is gone, North warns and stays on the current folder. The local pane and the pane beside the terminal do not have this list.

In that pane's context menu, **Add to monitoring** adds a file to the list and opens the panel. **Monitor live** opens the panel without saving the file on the connection. A folder, a link, another type, or more than one item leaves both items unavailable. The local pane and FTP connections do not get the button or these items.

- Drag files or folders from one pane to the other to copy them. Folders are copied with everything inside. You can also drag from Finder/Explorer straight onto the server pane.
- Shortcuts in the active pane: **F5** copies the selection to the other side, **F2** renames, **F7** creates a folder, **Del** deletes, **Enter** opens, **Backspace** goes up a folder. **⌘/Ctrl+click** and **Shift+click** select several items.
- Double-clicking a local file opens it in the system's default app; a remote file is downloaded to the folder open on the left.
- In the remote pane's menu, **Edit** opens a text file in North's editor. **Save** (or Ctrl/Cmd+S) sends it back and replaces the file on the server. **Edit with…** opens an editor registered in Settings → Editors; each save in that program sends the file back too. A folder, a binary file, or a file that is too large shows a notice and does not open. Closing the tab or the session deletes the temporary copy and stops the upload. **Open** and double-click still only download.
- Columns show size, date, permissions (`rwxr-xr-x`) and owner; click a header to sort. The bar shows each folder in the path: click a segment to open that folder. The last segment, or the empty stretch of the bar, opens the field for typing; Enter confirms and Esc goes back. On Windows, the selector next to it switches drives.
- The queue at the bottom shows each transfer with its progress and a cancel button. Cancelling stops the file in flight right away and removes the partial copy.
- If an item already exists at the destination, North asks first: **Overwrite**, **Skip existing** or **Cancel**. The choice also applies to the files inside folders.
- Deleting in the local pane moves items to the system trash. The server has no trash (SFTP/FTP don't have one), so the confirmation says it is permanent and that folders go with everything inside.

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
