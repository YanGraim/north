## VPNs

- **OpenVPN with MikroTik:** OpenVPN servers on MikroTik (RouterOS), which dropped the connection right after the login, now connect with the original `.ovpn`. North adjusts the TLS and cipher they require by itself
- **More useful VPN log:** each new connection starts a clean log, with no repeated lines, and shows why the server dropped the connection. If it drops three times in a row right after the login, North stops and tells you instead of waiting for the timeout
- **Tray menu:** each VPN shows a status dot, green when connected, amber while connecting and gray when off, on macOS, Windows and Linux
- **Titlebar indicator:** the name shown is now the VPN that is connecting or failed, matching the dot's color

See the [VPNs](vpns) chapter in the manual.
