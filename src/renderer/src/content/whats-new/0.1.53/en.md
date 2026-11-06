## OpenVPN in organizations

- **OpenVPN on clients and environments:** you can now pick an OpenVPN VPN for a client or environment in an organization. The server keeps only the VPN's address; the certificate and key in your `.ovpn` never leave your computer
- **Everyone with their own .ovpn:** whoever has imported their own `.ovpn` in North connects on their own; anyone who hasn't is asked to import it
- **Error when saving the VPN:** if a client's or environment's VPN can't be saved, North now tells you why instead of doing nothing

See the [VPNs](vpns) chapter in the manual.
