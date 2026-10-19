#!/bin/sh
# Windows: North ships the official OpenVPN MSI (pinned + sha256) and installs it once, silently,
# for its Interactive Service — see src/main/services/vpn/windows-vpn-component.ts.
#
#   scripts/vpn-binaries/fetch-windows.sh <out-dir>
set -eu
OUT=$1
OVPN=2.6.14
MSI=OpenVPN-$OVPN-I001-amd64.msi
SHA=19bca902826ef0dc9a6cf849297ce43ba8b2844bdb913c37230308d3274c953c

mkdir -p "$OUT/LICENSES"
curl -fsSL "https://swupdate.openvpn.org/community/releases/$MSI" -o "$OUT/$MSI"
got=$(sha256sum "$OUT/$MSI" 2>/dev/null || shasum -a 256 "$OUT/$MSI")
[ "${got%% *}" = "$SHA" ] || { echo "checksum mismatch: $MSI" >&2; rm -f "$OUT/$MSI"; exit 1; }
cat >"$OUT/LICENSES/SOURCES.txt" <<EOF
VPN engines bundled with North (Windows)
========================================

North ships the unmodified official OpenVPN $OVPN installer ($MSI) and installs it
on request so its Interactive Service can start tunnels. OpenVPN is GPL-2.0 (with
the OpenSSL exception); its source code is available at:
  https://swupdate.openvpn.org/community/releases/openvpn-$OVPN.tar.gz
EOF
echo "fetched $MSI into $OUT"
