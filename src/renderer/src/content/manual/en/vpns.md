# VPNs

North stores your clients' VPNs and turns each one on with a click, without opening FortiClient or OpenVPN Connect. The VPN applies to the whole system, including your browser.

## Adding a VPN

In **VPNs** in the sidebar, click **New VPN** or drop an `.ovpn` file onto the screen.

- **OpenVPN (.ovpn):** North reads the file, shows the server and asks **only** for what it needs: username and password, the private key password, or nothing. Files that try to run scripts (`up`, `down`, `plugin`, `script-security 2`…) are rejected, with the reason on screen.
- **FortiGate SSL-VPN:** FortiClient's "SSL-VPN" tab. Fill in name, remote gateway, port, username and password; if you paste `ip:port` into the gateway, North splits it. Many FortiGates use their own certificate: on the first connection North shows its fingerprint (SHA-256) and only connects after you click **Trust this certificate and connect**. If the certificate changes later, it blocks and warns you. On Linux it needs the `ppp` package (preinstalled on most distributions). Works on macOS and Linux; Windows arrives in an upcoming version.
- **FortiGate / IPsec (IKEv1) and IKEv2:** the fields use the same names and order as FortiClient (remote gateway, pre-shared key, XAuth, username). FortiGate IKEv1 connects through strongSwan with FortiClient's own proposals (AES, SHA1/SHA256, DH group 5) — no profile to approve in System Settings and, with the VPN component installed, no password prompt. IKEv2 and Windows can only be saved for now. If you reach VPN servers by name, fill in **Internal domains** under Edit (e.g. `company.local`): only those names use the VPN's DNS, everything else keeps your DNS (macOS).

Passwords, the pre-shared key and private keys embedded in the `.ovpn` go into North's vault and never show up in logs.

## Editing

At the top of a VPN, **Edit** opens its settings. Under **Connection** you can change the type (SSL-VPN, IPsec or IKEv2), gateway, port, username, group and XAuth without deleting the VPN; saved credentials keep working. For an OpenVPN, **Replace .ovpn file** swaps the file and keeps the name, client and password. If the gateway or port changes, North asks you to confirm the certificate again.

## Turning VPNs on and off

- From the **VPN** pill in the top bar: each VPN has a switch, with its status, IP and uptime. The pill turns green with one VPN on, shows "2 VPNs" with two, amber while connecting and red if one drops.
- From the **VPNs** screen: **Connect** / **Turn off** button and the **Overview**, **Settings**, **Logs** and **History** tabs.

macOS and Linux need administrator permission for a VPN to change routes and DNS. On the first launch with VPNs, North offers to install the **VPN component** (the way FortiClient does): the system asks for the password once, and from then on SSL-VPN, IPsec and OpenVPN connect and disconnect without a prompt. If you decline, it offers again on the first connection; the button at the bottom of the VPN list installs or removes it. The component can only connect and disconnect VPNs, nothing else. Without it, every connection asks for the password. An `.ovpn` with unusual options (scripts, external files) still asks every time, for safety. North ships openfortivpn, strongSwan and OpenVPN on macOS and Linux: nothing to install (their licenses sit next to them, in the app's `vpn-bin` folder).

## Several VPNs at once

Two VPNs with different networks can stay on together. If the networks overlap, or one of them redirects all traffic, North warns you first and lets you pick **Turn off and connect**, **Connect anyway** or **Cancel**.

## When something goes wrong

The message says what happened and offers the right action: **Update password** when the server rejects the credential, **Try again** when the server doesn't respond or the administrator prompt is denied, **How to install** when OpenVPN is missing. In **Logs**, **Copy diagnostics** copies the log with passwords already removed.

## Turn the VPN on automatically

In **Edit environment** (or **Edit client**), pick its **VPN**. From then on, opening an SSH, RDP, database or API session in that environment turns the VPN on first, waits for the server to answer and only then opens the session; several sessions share one tunnel, which turns off by itself when the last one closes (if the VPN auto-disconnects). The environment's own VPN wins; without one, the client's applies. On each connection or access, the **VPN** field offers **Inherit** (default), **Never use a VPN** or another VPN. If the VPN fails, the session shows the error with its name. The connection monitor doesn't flag a server as down while its VPN is off.
