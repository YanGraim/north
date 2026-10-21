# Overview

**North** is a desktop workspace for infrastructure — not just an SSH launcher.

Organize clients, environments, remote connections and accesses (database credentials or portal logins) in one place. Remote sessions run **inside the app**: embedded terminal, desktop and file transfer.

## What you get

- Clear hierarchy: Client → Environment → Group → items
- In-app sessions without relying on external clients
- Credentials in the local vault (`safeStorage` / OS keychain)
- Group workflows for repeatable actions (deploy, restart, health-check)
- Command Palette and shortcuts to go from inventory to session in seconds
- Local profile (display name and optional e-mail) in **Settings** — this machine only, shown in the sidebar chip
- App font (family and size) in **Settings → App font** — applies to the whole interface, terminal, code editors, hosts/ports, and shortcuts

## Workspaces

The button at the top right, next to VPN, shows which workspace you're in. **My workspace** stays on this computer, in the local database and the system vault. Use the **+** next to **Organizations**, enter your company's North Server address and click **Sign in with Microsoft**: your browser opens your company's sign-in page (Entra ID) and, once you sign in, you come back to North already inside the organization. North never sees your Microsoft password. Test servers also accept sign-in by e-mail. In an organization, clients, environments, groups, connections and tags live on the server and are shared with the team; favorites are yours only. Nothing syncs between workspaces. You can already connect from an organization. Each connection's password is stored encrypted on the server, and North fetches it only when opening the session, keeping no copy on this computer. Every time a password is read (to connect or to paste into the terminal), the server records who read it and why. In an organization, each person sees only the projects (client, environment or group) an admin shared with them, with one of three roles: **Admin** does everything and creates clients; **Editor** creates, edits and deletes what is inside the project; **Viewer** sees and connects, but cannot edit, reveal or paste the password. Buttons you cannot use are hidden. If the tree is empty, ask an organization admin for access. Admins open the **Admin panel** from the workspace selector (or at the server address followed by `/admin`) to add people, give and remove project access, disable people who left and see the audit. All of this applies right away: what the team changes shows up in your North without reloading, and anyone who loses access to a connection has its session closed. A disabled person leaves the organization and goes back to My workspace. Private keys and VPNs stay per computer. Accesses, workflows and APIs inside an organization come in the next versions. To bring what you already have into the organization (or take it back), right-click a client, environment, group or connection and use **Copy to workspace…**: pick the workspace and where to put it, and check **Copy passwords** to take them along. The copy is new and independent, so changing one doesn't change the other. Passwords copied to the organization go encrypted to the server, and each password read from the organization is audited. Database/login accesses and workflows are left out for now, and North tells you. Spreadsheet (CSV) import, in Settings, also works inside an organization, for servers only. To leave, open the selector and pick **Leave this organization**.
