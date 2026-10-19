#!/bin/sh
# Builds the VPN engines North bundles: openfortivpn, charon-cmd (strongSwan) and openvpn,
# each a single self-contained executable (OpenSSL linked statically, strongSwan
# monolithic with its plugins built in), so nothing depends on Homebrew or distro libs.
#
#   scripts/vpn-binaries/build.sh <out-dir>     (macOS or Linux; CI runs it before dist)
#   VPN_ENGINES=charon SWAN_EXTRA=--enable-kernel-libipsec …   (only charon-cmd, for North's WSL distro)
#
# Sources are pinned by version + sha256. Licenses and source links go to <out-dir>/LICENSES.
set -eu

OUT=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
WORK=${VPN_BUILD_DIR:-$(mktemp -d)}
PREFIX=$WORK/prefix
JOBS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
HERE=$(cd "$(dirname "$0")" && pwd)

OPENSSL=3.5.4
OPENSSL_SHA=967311f84955316969bdb1d8d4b983718ef42338639c621ec4c34fddef355e99
FORTI=1.23.1
FORTI_SHA=ecacfc7f18d87f4ff503198177e51a83316b59b4646f31caa8140fdbfaa40389
OVPN=2.6.14
OVPN_SHA=9eb6a6618352f9e7b771a9d38ae1631b5edfeed6d40233e243e602ddf2195e7a
SWAN=6.1.0
SWAN_SHA=fe6c97481298767213cfc2e9a1da29fdd8018d481ff4cb9cf0283099654f20d4

fetch() { # url sha file
  [ -f "$WORK/$3" ] || curl -fsSL "$1" -o "$WORK/$3"
  got=$( (sha256sum "$WORK/$3" 2>/dev/null || shasum -a 256 "$WORK/$3") | cut -d' ' -f1)
  [ "$got" = "$2" ] || { echo "checksum mismatch: $3" >&2; exit 1; }
}

# before OpenSSL too: every object must target the same minimum OS
case "$(uname -s)" in
  Darwin) export MACOSX_DEPLOYMENT_TARGET=12.0 ;;
  Linux) export LIBS="-ldl -pthread" ;;
esac

mkdir -p "$WORK" "$PREFIX" "$OUT/LICENSES"
cd "$WORK"
fetch "https://github.com/openssl/openssl/releases/download/openssl-$OPENSSL/openssl-$OPENSSL.tar.gz" $OPENSSL_SHA openssl.tar.gz
fetch "https://github.com/adrienverge/openfortivpn/archive/refs/tags/v$FORTI.tar.gz" $FORTI_SHA openfortivpn.tar.gz
fetch "https://swupdate.openvpn.org/community/releases/openvpn-$OVPN.tar.gz" $OVPN_SHA openvpn.tar.gz
fetch "https://download.strongswan.org/strongswan-$SWAN.tar.bz2" $SWAN_SHA strongswan.tar.bz2

# OpenSSL: static only, nothing else on the system is picked up afterwards
if [ ! -f "$PREFIX/lib/libcrypto.a" ]; then
  rm -rf openssl-$OPENSSL && tar xzf openssl.tar.gz && cd openssl-$OPENSSL
  ./config no-shared no-tests no-docs no-module --prefix="$PREFIX" --libdir=lib
  make -j"$JOBS" >/dev/null && make install_sw >/dev/null
  cd "$WORK"
fi
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig"
export PKG_CONFIG_PATH=
export CPPFLAGS="-I$PREFIX/include"
export LDFLAGS="-L$PREFIX/lib"

ENGINES=${VPN_ENGINES:-forti openvpn charon}
has() { case " $ENGINES " in *" $1 "*) return 0 ;; esac; return 1; }

# openfortivpn
if has forti; then
rm -rf openfortivpn-$FORTI && tar xzf openfortivpn.tar.gz && cd openfortivpn-$FORTI
./autogen.sh >/dev/null
./configure --prefix=/ --sysconfdir=/etc >/dev/null
make -j"$JOBS" >/dev/null
cp openfortivpn "$OUT/openfortivpn"
cp LICENSE "$OUT/LICENSES/openfortivpn-LICENSE"
cd "$WORK"
fi

if has openvpn; then
# openvpn (no LZO/LZ4/pkcs11: the helper's whitelist doesn't allow compression anyway)
rm -rf openvpn-$OVPN && tar xzf openvpn.tar.gz && cd openvpn-$OVPN
OVPN_EXTRA=""
if [ "$(uname -s)" = Linux ]; then
  OVPN_EXTRA="--disable-dco"
  # libcap-ng is the system's (pkg-config only sees our prefix, to keep OpenSSL ours)
  export LIBCAPNG_CFLAGS="" LIBCAPNG_LIBS="-lcap-ng"
fi
# shellcheck disable=SC2086
./configure --disable-lzo --disable-lz4 --disable-plugins --disable-plugin-auth-pam \
  --disable-plugin-down-root --disable-pkcs11 --disable-unit-tests $OVPN_EXTRA >/dev/null
make -j"$JOBS" >/dev/null
cp src/openvpn/openvpn "$OUT/openvpn"
cp COPYING "$OUT/LICENSES/openvpn-COPYING"
cd "$WORK"
fi

# strongSwan charon-cmd: monolithic + static, the plugins the helper loads are built in
rm -rf strongswan-$SWAN && tar xjf strongswan.tar.bz2 && cd strongswan-$SWAN
SWAN_KERNEL="--enable-kernel-netlink --enable-resolve"
[ "$(uname -s)" = Darwin ] && SWAN_KERNEL="--enable-kernel-pfkey --enable-kernel-pfroute --enable-osx-attr --disable-kernel-netlink"
# shellcheck disable=SC2086
./configure --disable-defaults --enable-static --disable-shared --enable-monolithic \
  --enable-charon --enable-cmd --enable-ikev1 --enable-ikev2 --enable-openssl --enable-nonce \
  --enable-random --enable-pem --enable-pkcs1 --enable-pkcs8 --enable-x509 --enable-pubkey \
  --enable-constraints --enable-revocation --enable-socket-default --enable-unity \
  --enable-xauth-generic --enable-kdf $SWAN_KERNEL ${SWAN_EXTRA:-} >/dev/null
make -j"$JOBS" >/dev/null
cp src/charon-cmd/charon-cmd "$OUT/charon-cmd"
cp COPYING "$OUT/LICENSES/strongswan-COPYING"
cd "$WORK"

cp "openssl-$OPENSSL/LICENSE.txt" "$OUT/LICENSES/openssl-LICENSE.txt"
sed -e "s/@OPENSSL@/$OPENSSL/g" -e "s/@FORTI@/$FORTI/g" -e "s/@OVPN@/$OVPN/g" -e "s/@SWAN@/$SWAN/g" \
  "$HERE/SOURCES.txt.in" >"$OUT/LICENSES/SOURCES.txt"
for b in openfortivpn openvpn charon-cmd; do
  [ -f "$OUT/$b" ] || continue
  chmod 755 "$OUT/$b"
  strip "$OUT/$b" 2>/dev/null || true
done
echo "built into $OUT"
