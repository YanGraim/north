#!/usr/bin/env python3
"""Generates the status dots of the tray menu (resources/tray/dot-*.png), stdlib only.

Colored on purpose (not template images): the color is the status, on every OS.
"""
import struct
import zlib

COLORS = {'on': (34, 197, 94), 'busy': (245, 158, 11), 'off': (156, 163, 175)}


def png(size, rgb):
    radius, center, ss = size * 0.3, size / 2, 4
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            hits = sum(
                ((x + (i + 0.5) / ss - center) ** 2 + (y + (j + 0.5) / ss - center) ** 2) <= radius**2
                for i in range(ss)
                for j in range(ss)
            )
            row += bytes(rgb) + bytes([round(255 * hits / ss**2)])
        rows.append(bytes(row))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b''.join(rows)))
        + chunk(b'IEND', b'')
    )


for name, rgb in COLORS.items():
    for size, suffix in ((16, ''), (32, '@2x')):
        with open(f'resources/tray/dot-{name}{suffix}.png', 'wb') as f:
            f.write(png(size, rgb))
