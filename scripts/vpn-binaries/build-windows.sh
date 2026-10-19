#!/bin/sh
# Windows VPN engines, assembled on Linux inside a fedora container (CI job "vpn-windows"):
#   - north-vpn-service.exe   (resources/vpn/windows-service, Go, cross-compiled)
#   - openconnect/            Fedora's mingw64-openconnect + every DLL it needs, Wintun,
#                             vpnc-script-win.js (routes/DNS of the FortiGate SSL-VPN)
#   - OpenVPN MSI             (fetch-windows.sh)
#
#   docker run --rm -v "$PWD:/src" -w /src fedora:42 scripts/vpn-binaries/build-windows.sh resources/vpn/bin
set -eu
OUT=$1
WINTUN=0.14.1
WINTUN_SHA=07c256185d6ee3652e09fa55c0b673e2624b565e02c4b9091c79ca7d2f24ef51
GO=1.24.9
ROOT=/usr/x86_64-w64-mingw32/sys-root/mingw

dnf -y -q install mingw64-openconnect mingw64-binutils unzip curl tar >/dev/null
mkdir -p "$OUT/openconnect" "$OUT/LICENSES"

# every DLL openconnect.exe pulls in from the mingw root, transitively
copy_deps() {
  for dll in $(x86_64-w64-mingw32-objdump -p "$1" | sed -n 's/.*DLL Name: //p'); do
    src="$ROOT/bin/$dll"
    [ -f "$src" ] || continue # a Windows system DLL
    [ -f "$OUT/openconnect/$dll" ] && continue
    cp "$src" "$OUT/openconnect/"
    copy_deps "$src"
  done
}
cp "$ROOT/bin/openconnect.exe" "$OUT/openconnect/"
copy_deps "$ROOT/bin/openconnect.exe"
script=$(find /usr/x86_64-w64-mingw32 /usr/share -name 'vpnc-script-win.js' 2>/dev/null | head -1)
[ -n "$script" ] || { echo "vpnc-script-win.js not found" >&2; exit 1; }
cp "$script" "$OUT/openconnect/vpnc-script-win.js"

tmp=$(mktemp -d)
curl -fsSL "https://www.wintun.net/builds/wintun-$WINTUN.zip" -o "$tmp/wintun.zip"
echo "$WINTUN_SHA  $tmp/wintun.zip" | sha256sum -c - >/dev/null
unzip -q "$tmp/wintun.zip" -d "$tmp"
cp "$tmp/wintun/bin/amd64/wintun.dll" "$OUT/openconnect/"
cp "$tmp/wintun/LICENSE.txt" "$OUT/LICENSES/wintun-LICENSE.txt"

# the service (pure Go, no cgo)
curl -fsSL "https://go.dev/dl/go$GO.linux-amd64.tar.gz" | tar -C "$tmp" -xz
(cd resources/vpn/windows-service &&
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 "$tmp/go/bin/go" build -trimpath -ldflags="-s -w" \
    -o "../../../$OUT/north-vpn-service.exe" .)

version=$(rpm -q --qf '%{VERSION}-%{RELEASE}' mingw64-openconnect)
"$(dirname "$0")/fetch-windows.sh" "$OUT"
cat >>"$OUT/LICENSES/SOURCES.txt" <<EOF

OpenConnect $version (Fedora mingw64-openconnect)  LGPL-2.1
  https://www.infradead.org/openconnect/download.html
  https://src.fedoraproject.org/rpms/mingw-openconnect
  The bundled DLLs (GnuTLS, libxml2, …) come from Fedora's mingw64-* packages, each
  under its own license; sources: https://src.fedoraproject.org/

Wintun $WINTUN  (prebuilt, signed by WireGuard LLC; license in wintun-LICENSE.txt)
  https://www.wintun.net/

north-vpn-service: part of North (resources/vpn/windows-service).
EOF
rm -rf "$tmp"
ls -la "$OUT" "$OUT/openconnect"
