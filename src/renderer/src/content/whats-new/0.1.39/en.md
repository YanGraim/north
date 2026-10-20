## Import / export

- **Workflows and variables in the backup:** the exported JSON now carries each group's workflows and variables, ready to use in the other North
- **FortiGate VPNs in the backup:** SSL-VPN and IPsec VPNs go in the file, along with which VPN each client, environment and connection uses. User and password don't (they're personal): when connecting, North asks you to fill in yours. OpenVPN stays out, since everyone has their own `.ovpn`

See the [Import / export](import-export) chapter in the manual.
