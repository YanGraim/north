# VPNs

North stores your clients' VPNs and turns each one on with a click, without opening FortiClient or OpenVPN Connect. The VPN applies to the whole system, including your browser.

## Adding a VPN

In **VPNs** in the sidebar, click **New VPN** or drop an `.ovpn` file onto the screen.

- **OpenVPN (.ovpn):** North reads the file, shows the server and asks **only** for what it needs: username and password, the private key password, or nothing. Files that try to run scripts (`up`, `down`, `plugin`, `script-security 2`…) are rejected, with the reason on screen.
- **FortiGate / IPsec (IKEv1) and IKEv2:** the fields use the same names and order as FortiClient (remote gateway, pre-shared key, XAuth, username). For now these kinds can be saved but not connected; connecting arrives in an upcoming version.

Passwords, the pre-shared key and private keys embedded in the `.ovpn` go into North's vault and never show up in logs.

## Turning VPNs on and off

- From the **VPN** pill in the top bar: each VPN has a switch, with its status, IP and uptime. The pill turns green with one VPN on, shows "2 VPNs" with two, amber while connecting and red if one drops.
- From the **VPNs** screen: **Connect** / **Turn off** button and the **Overview**, **Settings**, **Logs** and **History** tabs.

macOS and Linux ask for the administrator password on every connection, because a VPN changes routes and DNS. OpenVPN must be installed (`brew install openvpn` on macOS).

## Several VPNs at once

Two VPNs with different networks can stay on together. If the networks overlap, or one of them redirects all traffic, North warns you first and lets you pick **Turn off and connect**, **Connect anyway** or **Cancel**.

## When something goes wrong

The message says what happened and offers the right action: **Update password** when the server rejects the credential, **Try again** when the server doesn't respond or the administrator prompt is denied, **How to install** when OpenVPN is missing. In **Logs**, **Copy diagnostics** copies the log with passwords already removed.
