#!/bin/sh
# Windows VPN engines, assembled on Linux inside a fedora container (CI job "vpn-windows"):
#   - north-vpn-service.exe   (resources/vpn/windows-service, Go, cross-compiled)
#   - openconnect/            openconnect cross-built with Fedora's mingw64 toolchain + every DLL it needs, Wintun,
#                             vpnc-script-win.js (routes/DNS of the FortiGate SSL-VPN)
#   - OpenVPN MSI             (fetch-windows.sh)
#
#   docker run --rm -v "$PWD:/src" -w /src fedora:42 scripts/vpn-binaries/build-windows.sh resources/vpn/bin
set -eux
OUT=$1
WINTUN=0.14.1
WINTUN_SHA=07c256185d6ee3652e09fa55c0b673e2624b565e02c4b9091c79ca7d2f24ef51
GO=1.24.9
OC=9.21
OC_SHA=5b32369467db6e5f317aa1ed12cfcbb81ed00bdbc765450b6bfcbdc300944a58
VPNC_COMMIT=ce9e961bd0f6b867e1c7c35f78f6fb973f6ff101
VPNC_SHA=e196fdf0cc8b325180154535f843034dc0ae9eb43ead9980adfcfc57c58069b2
ROOT=/usr/x86_64-w64-mingw32/sys-root/mingw

# the image ships curl-minimal: asking for curl would conflict. Fedora has no openconnect
# for mingw, so it is built from the release tarball, like upstream's own Windows CI does
dnf -y install --allowerasing mingw64-gcc mingw64-binutils mingw64-gnutls mingw64-libxml2 \
  mingw64-zlib mingw64-pkg-config make gzip unzip tar findutils
mkdir -p "$OUT/openconnect" "$OUT/LICENSES"
OUT=$(cd "$OUT" && pwd)

tmp=$(mktemp -d)
curl -fsSL "https://www.infradead.org/openconnect/download/openconnect-$OC.tar.gz" -o "$tmp/oc.tar.gz"
echo "$OC_SHA  $tmp/oc.tar.gz" | sha256sum -c -
tar -C "$tmp" -xzf "$tmp/oc.tar.gz"
(cd "$tmp/openconnect-$OC" &&
  mingw64-configure --disable-nls --without-gnutls-version-check --without-libproxy \
    --without-stoken --without-libpskc --without-libpcsclite --without-gssapi --without-lz4 \
    --disable-docs &&
  make -j"$(nproc)" &&
  make install DESTDIR="$tmp/inst")
INST="$tmp/inst$ROOT"

# every DLL openconnect.exe pulls in from the mingw root, transitively
copy_deps() {
  for dll in $(x86_64-w64-mingw32-objdump -p "$1" | sed -n 's/.*DLL Name: //p'); do
    src="$ROOT/bin/$dll"
    [ -f "$INST/bin/$dll" ] && src="$INST/bin/$dll"
    [ -f "$src" ] || continue # a Windows system DLL
    [ -f "$OUT/openconnect/$dll" ] && continue
    cp "$src" "$OUT/openconnect/"
    copy_deps "$src"
  done
}
cp "$INST/bin/openconnect.exe" "$OUT/openconnect/"
copy_deps "$INST/bin/openconnect.exe"
script=$(find "$tmp/inst" /usr/share /etc -name 'vpnc-script-win.js' 2>/dev/null | head -1)
if [ -n "$script" ]; then
  cp "$script" "$OUT/openconnect/vpnc-script-win.js"
else
  # not packaged by Fedora: upstream's, pinned
  curl -fsSL "https://gitlab.com/api/v4/projects/openconnect%2Fvpnc-scripts/repository/files/vpnc-script-win.js/raw?ref=$VPNC_COMMIT" \
    -o "$OUT/openconnect/vpnc-script-win.js"
  echo "$VPNC_SHA  $OUT/openconnect/vpnc-script-win.js" | sha256sum -c -
fi

curl -fsSL "https://www.wintun.net/builds/wintun-$WINTUN.zip" -o "$tmp/wintun.zip"
echo "$WINTUN_SHA  $tmp/wintun.zip" | sha256sum -c - >/dev/null
unzip -q "$tmp/wintun.zip" -d "$tmp"
cp "$tmp/wintun/bin/amd64/wintun.dll" "$OUT/openconnect/"
cp "$tmp/wintun/LICENSE.txt" "$OUT/LICENSES/wintun-LICENSE.txt"

# the service (pure Go, no cgo)
curl -fsSL "https://go.dev/dl/go$GO.linux-amd64.tar.gz" | tar -C "$tmp" -xz
(cd resources/vpn/windows-service &&
  GOOS=windows GOARCH=amd64 CGO_ENABLED=0 "$tmp/go/bin/go" build -trimpath -ldflags="-s -w" \
    -o "$OUT/north-vpn-service.exe" .)

"$(dirname "$0")/fetch-windows.sh" "$OUT"
cat >>"$OUT/LICENSES/SOURCES.txt" <<EOF

OpenConnect $OC  LGPL-2.1, built from openconnect-$OC.tar.gz (sha256 $OC_SHA)
  https://www.infradead.org/openconnect/download.html
  The bundled DLLs (GnuTLS, libxml2, …) come from Fedora's mingw64-* packages, each
  under its own license; sources: https://src.fedoraproject.org/

Wintun $WINTUN  (prebuilt, signed by WireGuard LLC; license in wintun-LICENSE.txt)
  https://www.wintun.net/

north-vpn-service: part of North (resources/vpn/windows-service).
EOF
rm -rf "$tmp"
ls -la "$OUT" "$OUT/openconnect"
