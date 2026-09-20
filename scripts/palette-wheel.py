"""Crta paletu igre na OKLCh kotacu boja - kut je ton, udaljenost od sredista zasicenost,
velicina tocke svjetlina. Paleta se cita iz levels.js da ne moze odlutati od igre.

Pokretanje (lokalni Git Bash, u korijenu repoa water-sort):
    python scripts/palette-wheel.py [izlaz.png]
"""

import math
import re
import sys
from PIL import Image, ImageDraw, ImageFont

SS = 2  # supersampling
W, H = 1200, 860
BG = (23, 16, 41)
CX, CY = 470, 430
R_MAX = 330.0  # radijus koji odgovara zasicenosti C_MAX
C_MAX = 0.26

# Boje koje su zamijenjene - crtaju se supljim krugom, crtkano vezanim uz nasljednicu.
OLD = []  # nema zabiljezenih starih boja

# Komentari u levels.js su bez dijakritika (stil ostalih komentara u repou) - za ispis se vracaju.
NAMES = {
    "zuta": "žuta",
    "ljubicasta": "ljubičasta",
    "narancasta": "narančasta",
    "roza": "ružičasta",
    "smeda": "smeđa",
    "celicna": "čelična",
}


def srgb_to_oklab(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = f(r), f(g), f(b)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def oklch_to_rgb(L, C, hue_deg):
    a = C * math.cos(math.radians(hue_deg))
    b = C * math.sin(math.radians(hue_deg))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    out = []
    for c in (r, g, bb):
        c = max(0.0, min(1.0, c))
        c = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
        out.append(int(round(c * 255)))
    return tuple(out)


def lch(hex_color):
    L, a, b = srgb_to_oklab(hex_color)
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def read_palette(path="levels.js"):
    src = open(path, encoding="utf-8").read()
    block = src[src.index("var PALETTE = [") : src.index("];", src.index("var PALETTE = ["))]
    out = []
    for line in block.splitlines():
        m = re.search(r'"(#[0-9a-fA-F]{6})",\s*//\s*([^(]+?)\s*(?:\((.+)\))?\s*$', line)
        if m:
            out.append((m.group(2), m.group(1), m.group(3) or ""))
    return out


def pos(C, hue_deg):
    r = min(1.0, C / C_MAX) * R_MAX
    return CX + r * math.cos(math.radians(hue_deg)), CY - r * math.sin(math.radians(hue_deg))


def font(size, bold=False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    try:
        return ImageFont.truetype("C:/Windows/Fonts/" + name, size)
    except OSError:
        return ImageFont.load_default()


def draw(path):
    img = Image.new("RGB", (W * SS, H * SS), BG)
    d = ImageDraw.Draw(img)
    s = lambda v: int(v * SS)

    # referentni prsten tonova
    ring_in, ring_out = R_MAX + 26, R_MAX + 62
    for step in range(720):
        a0, a1 = step * 0.5, step * 0.5 + 0.55
        col = oklch_to_rgb(0.78, 0.15, a0)
        pts = []
        for ang, rad in ((a0, ring_in), (a1, ring_in), (a1, ring_out), (a0, ring_out)):
            pts.append(
                (
                    s(CX + rad * math.cos(math.radians(ang))),
                    s(CY - rad * math.sin(math.radians(ang))),
                )
            )
        d.polygon(pts, fill=col)

    # mreza zasicenosti
    for frac in (0.25, 0.5, 0.75, 1.0):
        r = R_MAX * frac
        d.ellipse(
            [s(CX - r), s(CY - r), s(CX + r), s(CY + r)],
            outline=(58, 45, 88),
            width=s(1),
        )
        d.text(
            (s(CX + 6), s(CY - r - 16)),
            "C %.2f" % (C_MAX * frac),
            font=font(13),
            fill=(96, 86, 130),
        )
    for ang in range(0, 360, 30):
        x, y = pos(C_MAX, ang)
        d.line([s(CX), s(CY), s(x), s(y)], fill=(44, 34, 68), width=s(1))

    pal = read_palette()

    # stare boje - supalj krug i crtkana veza prema novoj na istom indeksu imena
    new_by_name = {p[0]: p[1] for p in pal}
    for name, hexv, successor in OLD:
        L, C, hue = lch(hexv)
        x, y = pos(C, hue)
        r = 9
        d.ellipse(
            [s(x - r), s(y - r), s(x + r), s(y + r)], outline=hexv, width=s(2)
        )
        d.text((s(x + 12), s(y - 8)), "prije", font=font(12), fill=(140, 130, 175))
        target = new_by_name.get(successor)
        if target:
            tx, ty = pos(*lch(target)[1:])
            dist = math.hypot(tx - x, ty - y)
            if dist > 24:
                steps = int(dist // 14)
                for k in range(steps):
                    if k % 2:
                        continue
                    t0, t1 = k / steps, min(1.0, (k + 1) / steps)
                    d.line(
                        [
                            s(x + (tx - x) * t0),
                            s(y + (ty - y) * t0),
                            s(x + (tx - x) * t1),
                            s(y + (ty - y) * t1),
                        ],
                        fill=(120, 108, 160),
                        width=s(1),
                    )

    # boje palete
    for idx, (name, hexv, family) in enumerate(pal):
        L, C, hue = lch(hexv)
        x, y = pos(C, hue)
        r = 13 + 20 * max(0.0, min(1.0, (L - 0.45) / 0.45))
        d.ellipse(
            [s(x - r), s(y - r), s(x + r), s(y + r)],
            fill=hexv,
            outline=(255, 255, 255),
            width=s(2),
        )
        if C < 0.05:  # gotovo neutralna boja sjedi u sredistu, oznaka ide ispod nje
            lx, ly, anchor = x, y + r + 22, "mm"
        else:
            lx = x + (r + 16) * math.cos(math.radians(hue))
            ly = y - (r + 16) * math.sin(math.radians(hue))
            anchor = "lm" if math.cos(math.radians(hue)) >= 0 else "rm"
        d.text(
            (s(lx), s(ly - 8)),
            NAMES.get(name, name),
            font=font(17, True),
            fill=(243, 238, 254),
            anchor=anchor,
        )
        d.text(
            (s(lx), s(ly + 10)),
            "%s  ton %d\u00b0" % (hexv, round(hue)),
            font=font(13),
            fill=(150, 140, 185),
            anchor=anchor,
        )

    # legenda
    lx, ly = 880, 90
    d.text((s(lx), s(ly)), "OKLCh kota\u010d boja", font=font(21, True), fill=(243, 238, 254))
    lines = [
        "kut = ton boje",
        "udaljenost od središta = zasićenost",
        "veličina točke = svjetlina",
        "",
        "DVIJE OBITELJI",
        "pune: svjetlina 0.5-0.7,",
        "      zasićenost 0.15-0.23",
        "pastelne: svjetlina 0.83-0.92,",
        "      zasićenost 0.08-0.15",
        "smeda je jedina tamna",
        "",
        "NAJMANJA UDALJENOST (OKLab)",
        "sada  0.149",
        "prije 0.131",
        "",
        "Redoslijed u paleti je slozen",
        "tako da rane razine dobiju",
        "najrazličitije boje.",
    ]
    for i, t in enumerate(lines):
        d.text((s(lx), s(ly + 38 + i * 24)), t, font=font(15), fill=(168, 158, 205))

    img.resize((W, H), Image.LANCZOS).save(path)
    print("spremljeno:", path)


if __name__ == "__main__":
    draw(sys.argv[1] if len(sys.argv) > 1 else "palette-wheel.png")
