## WinSCP-style files

- **Two panes:** SFTP and FTP now show your computer on the left and the server on the right. Drag files and folders between them, or press **F5** to copy the selection
- **Open files from an SSH connection:** right-click the connection → **Open files (SFTP)**, with the same user and password
- **Whole folders:** downloading or uploading a folder copies everything inside, with a transfer queue that shows progress and lets you cancel
- **More detail:** permissions and owner columns, sortable columns, an editable path bar and F2/F7/Del shortcuts
- **No surprises:** asks before overwriting files that already exist at the destination, and cancelling stops the file in flight right away

## Git on the server with your key

- **Forward SSH agent (ssh -A):** new option on SSH connections. Commands like `git pull` on the server use the key in your `ssh-agent`, without copying it there. Works on macOS, Linux and Windows (OpenSSH Authentication Agent service)

See the [Connect](connect) chapter in the manual.
