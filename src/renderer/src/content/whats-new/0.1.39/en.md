## Import / export

- **Workflows and variables in the backup:** the exported JSON now carries each group's workflows and variables, ready to use in the other North
- **FortiGate VPNs in the backup:** SSL-VPN and IPsec VPNs go in the file, along with which VPN each client, environment and connection uses. User and password don't (they're personal): when connecting, North asks you to fill in yours. OpenVPN stays out, since everyone has their own `.ovpn`

See the [Import / export](import-export) chapter in the manual.

## Windows VPN

- **New Windows VPN (Windows only):** in **New VPN**, pick **Windows VPN** and the protocol: Automatic, PPTP, L2TP/IPsec with pre-shared key, SSTP or IKEv2, just like Windows. Turn it on from North, from the tray icon or automatically before sessions, and it goes into the backup without username and password

See the [VPNs](vpns) chapter in the manual.

## Startup

- **Open North with the computer (optional):** in Settings → Startup, North can open by itself when you sign in to Windows, macOS or Linux. Off by default
