## VPNs

- **FortiGate SSL-VPN on Windows:** VPNs that push many routes, which dropped right after connecting and kept reconnecting, now connect normally. North no longer waits for Windows to finish creating every route before keeping the tunnel up
- **FortiGate SSL-VPN on Windows without drops:** North no longer uses the UDP channel (DTLS) with the FortiGate, only TLS, as it already did on the Mac. This ends VPNs dropping seconds after connecting, with "Detected dead peer" in the log

See the [VPNs](vpns) chapter in the manual.
