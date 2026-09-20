"""Generira PWA ikone (192, 512, 512-maskable) - boca s cetiri sloja tekucine.

Pokretanje (lokalni Git Bash, u korijenu repoa water-sort):
    python scripts/make-icons.py
"""

from PIL import Image, ImageDraw

BG_TOP = (58, 42, 104)
BG_BOTTOM = (23, 16, 41)
BANDS = ["#ef3b4b", "#ffd23f", "#2f9bf5", "#21bf73"]  # odozgo prema dolje
GLASS = (255, 255, 255, 235)
SS = 4  # supersampling


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def make_icon(size, content_scale):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # pozadina - vertikalni gradijent u zaobljenom kvadratu
    grad = Image.new("RGBA", (1, s))
    gd = ImageDraw.Draw(grad)
    for y in range(s):
        t = y / max(1, s - 1)
        gd.point(
            (0, y),
            fill=tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)) + (255,),
        )
    grad = grad.resize((s, s))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=255)
    img.paste(grad, (0, 0), mask)

    # geometrija boce
    bw = s * 0.34 * content_scale
    bh = s * 0.62 * content_scale
    cx, cy = s / 2, s / 2
    x0, y0 = cx - bw / 2, cy - bh / 2
    x1, y1 = cx + bw / 2, cy + bh / 2
    wall = max(2, int(s * 0.018))

    inner = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    idr = ImageDraw.Draw(inner)
    band_h = (y1 - y0) / len(BANDS)
    for i, color in enumerate(BANDS):
        idr.rectangle([x0, y0 + i * band_h, x1, y0 + (i + 1) * band_h], fill=hex_rgb(color) + (255,))

    bottle_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(bottle_mask).rounded_rectangle(
        [x0, y0, x1, y1], radius=int(bw * 0.42), corners=(False, False, True, True), fill=255
    )
    ImageDraw.Draw(bottle_mask).rounded_rectangle(
        [x0, y0, x1, y0 + bw * 0.3], radius=int(bw * 0.12), fill=255
    )
    img.paste(inner, (0, 0), bottle_mask)

    # staklo - obrub i odsjaj
    d.rounded_rectangle(
        [x0, y0, x1, y1],
        radius=int(bw * 0.3),
        outline=GLASS,
        width=wall,
    )
    d.rounded_rectangle(
        [x0 + bw * 0.16, y0 + bh * 0.08, x0 + bw * 0.30, y0 + bh * 0.72],
        radius=int(bw * 0.07),
        fill=(255, 255, 255, 110),
    )
    # grlic
    d.rounded_rectangle(
        [x0 - bw * 0.09, y0 - bh * 0.055, x1 + bw * 0.09, y0 + bh * 0.01],
        radius=int(bw * 0.08),
        fill=GLASS,
    )
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    make_icon(192, 1.0).save("icons/icon-192.png")
    make_icon(512, 1.0).save("icons/icon-512.png")
    make_icon(512, 0.72).save("icons/icon-512-maskable.png")
    print("ikone spremljene u icons/")
