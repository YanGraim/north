#!/bin/sh
# North's WSL distro for IPsec on Windows (strongSwan has no usable Windows client), built
# inside an alpine container (CI job "vpn-wsl"):
#   - a minimal Alpine root (busybox, musl, iptables) from the container's own apk repos
#   - charon-cmd with kernel-libipsec (ESP on a TUN, no WSL kernel XFRM needed)
#   - north-vpn-helper (its "ipsec" command forwards/NATs Windows' traffic when /etc/north-wsl exists)
#
#   docker run --rm -v "$PWD:/src" -w /src alpine:3.22 scripts/vpn-binaries/build-wsl.sh resources/vpn/bin
set -eu
OUT=$1
HERE=$(cd "$(dirname "$0")" && pwd)
apk add -q build-base linux-headers perl python3 curl autoconf automake libtool pkgconf tar

work=$(mktemp -d)
VPN_ENGINES=charon SWAN_EXTRA=--enable-kernel-libipsec VPN_BUILD_DIR="$work/build" \
  "$HERE/build.sh" "$work/engines"

root="$work/root"
mkdir -p "$root/etc/apk" "$root/opt/north"
cp -r /etc/apk/keys "$root/etc/apk/"
cp /etc/apk/repositories "$root/etc/apk/"
apk add -q --root "$root" --initdb --no-cache --no-scripts alpine-baselayout busybox musl iptables
# --no-scripts skipped busybox's own install step: without its applet links the distro has
# no dirname, mount, ip, sysctl… (same musl as this container, so its busybox runs here)
for applet in $("$root/bin/busybox" --list-full); do
  [ -e "$root/$applet" ] || ln -s /bin/busybox "$root/$applet"
done
test -x "$root/usr/bin/dirname" && test -x "$root/bin/mount"
: >"$root/etc/fstab" # wsl runs "mount -a" at boot
cp "$work/engines/charon-cmd" "$root/opt/north/"
cp "$HERE/../../resources/vpn/north-vpn-helper" "$root/opt/north/"
chmod 755 "$root/opt/north/charon-cmd" "$root/opt/north/north-vpn-helper"
touch "$root/etc/north-wsl"
# no Windows PATH, no automount noise, no systemd: the distro only runs the helper
printf '%s\n' '[automount]' 'enabled = false' '[interop]' 'appendWindowsPath = false' '[boot]' 'systemd = false' \
  >"$root/etc/wsl.conf"

mkdir -p "$OUT/LICENSES"
tar -C "$root" -czf "$OUT/north-wsl.tar.gz" .
cp "$work/engines/LICENSES/strongswan-COPYING" "$OUT/LICENSES/"
cat >>"$OUT/LICENSES/SOURCES.txt" <<EOF

North WSL distro (north-wsl.tar.gz): Alpine Linux $(cat /etc/alpine-release) packages
(busybox GPL-2.0, musl MIT, iptables GPL-2.0; sources: https://gitlab.alpinelinux.org/alpine/aports)
and strongSwan charon-cmd built by scripts/vpn-binaries/build.sh (GPL-2.0-or-later,
https://download.strongswan.org/).
EOF
rm -rf "$work"
ls -la "$OUT/north-wsl.tar.gz"
