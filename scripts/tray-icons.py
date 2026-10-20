#!/usr/bin/env python3
"""Generates North's tray icons (resources/tray), no dependencies beyond the stdlib.

- trayTemplate.png / @2x: macOS menu bar "template" (black + alpha; macOS tints it for
  light/dark menu bars). The "N" with the compass arrow of resources/icon.png, as polygons
  in that icon's 1024px coordinates.
- tray.png / @2x (Windows, Linux) are the app icon itself, scaled with sips on macOS:
    sips -c 790 790 resources/icon.png --out /tmp/t.png && sips -z 32 32 /tmp/t.png --out resources/tray/tray@2x.png
"""
import struct
import sys
import zlib

GLYPH = [
    [(345, 345), (430, 345), (430, 705), (345, 705)],  # left bar
    [(345, 345), (430, 345), (715, 705), (630, 705)],  # diagonal
    [(630, 437), (715, 427), (715, 705), (630, 705)],  # right bar
    [(595, 437), (678, 185), (765, 437), (678, 390)],  # arrow
]
X0, Y0, X1, Y1 = 330, 175, 780, 715  # glyph box, kept square below


def inside(poly, x, y):
    hit = False
    for (ax, ay), (bx, by) in zip(poly, poly[1:] + poly[:1]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            hit = not hit
    return hit


def render(size, ss=6):
    side = max(X1 - X0, Y1 - Y0)
    ox, oy = X0 - (side - (X1 - X0)) / 2, Y0 - (side - (Y1 - Y0)) / 2
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            n = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = ox + (px + (sx + 0.5) / ss) / size * side
                    y = oy + (py + (sy + 0.5) / ss) / size * side
                    n += any(inside(p, x, y) for p in GLYPH)
            row += bytes([0, 0, 0, round(255 * n / (ss * ss))])
        rows.append(bytes(row))
    return b"".join(rows)


def png(path, size):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(render(size), 9)) + chunk(b"IEND", b""))


out = sys.argv[1] if len(sys.argv) > 1 else "resources/tray"
png(f"{out}/trayTemplate.png", 18)
png(f"{out}/trayTemplate@2x.png", 36)
