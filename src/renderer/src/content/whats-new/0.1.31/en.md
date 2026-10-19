## VPNs

- **VPNs inside North:** import a client's `.ovpn` (drop it on the screen) and turn the VPN on from the new **VPN** pill in the top bar, without opening OpenVPN Connect. Credentials stay in the vault, and North asks only for what the file needs
- **Several VPNs at once:** keep more than one on; if their networks overlap, North warns you before connecting
- **FortiGate SSL-VPN:** the same fields as FortiClient's SSL-VPN tab, with certificate fingerprint confirmation on the first connection (macOS and Linux)
- **No password on every connection:** install the VPN component once (North offers it on first launch) and SSL-VPN, IPsec and OpenVPN stop asking for the administrator password
- **FortiGate/IPsec:** add it with the same fields as FortiClient and connect through strongSwan with the same proposals, without FortiClient and without approving a profile in System Settings (macOS and Linux)
- **VPN that turns on by itself:** link a VPN to an environment or client and North turns it on when you open one of its sessions, and off when nobody uses it
- **Nothing to install:** North ships openfortivpn, strongSwan and OpenVPN (macOS and Linux), no Homebrew needed

See the [VPNs](vpns) chapter in the manual.
