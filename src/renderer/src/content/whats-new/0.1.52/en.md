## Workflows in organizations

- **Workflows for the team:** workflows and group variables now live in the organization. Whoever sees the group runs them; Editors and Admins change them
- **VPN comes up for workflows:** if the client uses a VPN, it connects before the first step and disconnects at the end, in My workspace and in organizations
- **Who updated:** Latest updates shows who ran each Git-tracked workflow
- **Full copy:** Copy to workspace and Copy from My workspace now bring workflows and variables along
- **Your teams:** Settings shows your role and which teams you are in
- **Admin panel:** check several items (or all clients) and share them at once
- **Fix:** a workflow that could not connect stayed "running" forever; it now fails and shows the error
- **SSH agent in workflows:** connections with "Forward SSH agent" now carry the agent into workflow steps, as in the terminal (e.g. `git pull` with your key)
- **OpenVPN on Windows:** fixes connecting on company laptops (domain or Entra ID accounts) and when OpenVPN was already installed; if OpenVPN quits before connecting, the VPN log now shows why

See the [Workflows](workflows) chapter in the manual.
