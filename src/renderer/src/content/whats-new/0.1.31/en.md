## VPNs

- **VPNs inside North:** import a client's `.ovpn` (drop it on the screen) and turn the VPN on from the new **VPN** pill in the top bar, without opening OpenVPN Connect. Credentials stay in the vault, and North asks only for what the file needs
- **Several VPNs at once:** keep more than one on; if their networks overlap, North warns you before connecting
- **FortiGate SSL-VPN:** the same fields as FortiClient's SSL-VPN tab, with certificate fingerprint confirmation on the first connection (macOS and Linux)
- **FortiGate/IPsec on macOS:** add it with the same fields as FortiClient and connect through macOS's own IPsec client, without FortiClient (the first time, approve the "North" profile in System Settings)

See the [VPNs](vpns) chapter in the manual.
