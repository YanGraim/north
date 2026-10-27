## SSH agent on Windows

- **Forward SSH agent:** on Windows, North now reliably finds the OpenSSH Authentication Agent service. Before, on some machines forwarding didn't work and `git` on the server failed with *Permission denied*
- **Terminal notice:** if forwarding can't be turned on (no agent running or the server refuses it), North says so in yellow, like `ssh -A`

See the [Connect](connect) chapter in the manual.
