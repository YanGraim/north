## VPNs

- **Open URL turns on the VPN:** on a login access (web portal), **Open URL** first turns on the VPN inherited from the environment or client, then opens the browser. That VPN stays on until you click **Turn off**
- **XAuth password rejected:** when the FortiGate rejects the username or password of an IPsec VPN, North tells you right away instead of waiting for the timeout
- **VPN service stopped on Windows:** if the North VPN service is stopped, North reinstalls and starts it again when connecting, asking for administrator permission once. The error now says "VPN component not found" instead of naming OpenVPN
- **OpenVPN log on Windows:** the log shows the connection steps and what OpenVPN logged from the start, and a timeout says which step it stopped at

See the [VPNs](vpns) chapter in the manual.
