#!/usr/bin/env python3
"""Derive 4-stop ramps (deep / bright / soft / ink) for KoodakBook.

DESIGN_CHARTER.md contract (2026-09, design-recovery — supersedes the earlier
"white text on a dark fill" contract):

  bright : the JOYFUL saturated fill everyone remembers — anchored straight on
           the Tailwind -400 step for each module. DARK `ink` TEXT SITS HERE.
  soft   : the pale tint (chip bg, tile image area) — anchored on Tailwind -50.
           Dark `ink` text sits here too (trivially — it's near white).
  ink    : icon / label / title colour used ON `bright` or `soft`.
           SOLVED so ratio(ink, bright) >= 5.0  (=> clears `soft` with room).
  deep   : the 3D bottom edge / border, and the ONLY stop white text may sit on.
           SOLVED so ratio(white, deep) >= 5.0, and always darker than `bright`.

Why anchor instead of solve `bright`: the beloved palette *is* the product
(see DESIGN_CHARTER.md). We don't get to re-pick the green — we pick the two
dark support stops that make dark-ink-on-bright clear WCAG AA. That keeps the
colour cheerful AND the text readable, instead of darkening the whole hue so
white text can pass.
"""
import colorsys

def srgb_to_lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(rgb):
    r, g, b = (srgb_to_lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return (round(r * 255), round(g * 255), round(b * 255))

def hexs(rgb):
    return '#%02X%02X%02X' % rgb

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def rgb_to_hsl(rgb):
    r, g, b = (c / 255 for c in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360, s, l

WHITE = (255, 255, 255)
# The child app never actually sits on pure white — .child-bg is a warm
# gradient and --color-warm-white is the body. Check the worst (darkest) end
# of that ground too, or the audit passes on a surface the app doesn't have.
WARM = (0xFF, 0xF5, 0xE0)   # darkest stop of .child-bg

def solve_l_darkest(h, s, target, against):
    """Binary-search lightness for the LIGHTEST (least-dark) colour whose
    contrast vs `against` still meets `target`. Used for the two dark stops:
    we want them exactly as dark as they need to be, no darker."""
    lo, hi = 0.0, 1.0
    best = None
    for _ in range(48):
        mid = (lo + hi) / 2
        if ratio(hsl(h, s, mid), against) >= target:
            best = mid
            lo = mid          # try lighter
        else:
            hi = mid
    return best if best is not None else lo

# module -> (bright anchor, soft anchor)  — straight from Tailwind, the palette
# the app shipped with (kit.tsx MODULE table at f94794e: solid = -400, soft = -50).
ANCHORS = {
    'brand':   ('#FBBF24', '#FEF3C7'),   # amber-400  / amber-100  — saffron identity
    'lessons': ('#34D399', '#ECFDF5'),   # emerald-400 / emerald-50
    'letters': ('#38BDF8', '#F0F9FF'),   # sky-400    / sky-50
    'phonics': ('#FB923C', '#FFF7ED'),   # orange-400 / orange-50
    'stories': ('#2DD4BF', '#F0FDFA'),   # teal-400   / teal-50
    'review':  ('#A78BFA', '#F5F3FF'),   # violet-400 / violet-50
    'speak':   ('#F472B6', '#FDF2F8'),   # pink-400   / pink-50
    'write':   ('#22D3EE', '#ECFEFF'),   # cyan-400   / cyan-50
    'math':    ('#818CF8', '#EEF2FF'),   # indigo-400 / indigo-50
    'games':   ('#C084FC', '#FAF5FF'),   # purple-400 / purple-50
    'rewards': ('#FBBF24', '#FFFBEB'),   # amber-400  / amber-50
}

print(f"{'ramp':9} {'deep':8} {'bright':8} {'soft':8} {'ink':8}  "
      f"{'ink/brt':>7} {'ink/soft':>8} {'wht/deep':>8} {'deep/brt':>8} "
      f"{'ink/warm':>8}")
print('-' * 100)

out = {}
for name, (bright_hex, soft_hex) in ANCHORS.items():
    bright = hex_to_rgb(bright_hex)
    soft = hex_to_rgb(soft_hex)
    h, s_b, _ = rgb_to_hsl(bright)

    # deep: same hue, a touch more saturated so it reads as "the dark of this
    # colour" rather than a wash. Solved to 7.0 vs white — that lands it around
    # the Tailwind -700 step: a proper dark edge under `bright`, comfortable AA
    # headroom for the rare white-on-deep label, and dark text on `soft`.
    s_d = min(1.0, s_b + 0.06)
    ld = solve_l_darkest(h, s_d, 7.0, WHITE)
    deep = hsl(h, s_d, ld)

    # ink: same hue, saturated, solved against `bright` (the harder of the two
    # surfaces — soft is near white). 5.0 keeps a real margin over the 4.5 floor
    # once the warm ground and sub-pixel AA nibble at it.
    s_i = min(1.0, s_b + 0.10)
    li = solve_l_darkest(h, s_i, 5.0, bright)
    ink = hsl(h, s_i, li)

    # Guarantee the 3D cue survives: deep must be visibly darker than bright.
    assert lum(deep) < lum(bright), f"{name}: deep not darker than bright"

    out[name] = (deep, bright, soft, ink)
    print(f"{name:9} {hexs(deep):8} {bright_hex:8} {soft_hex:8} {hexs(ink):8}  "
          f"{ratio(ink, bright):7.2f} {ratio(ink, soft):8.2f} "
          f"{ratio(deep, WHITE):8.2f} {ratio(deep, bright):8.2f} "
          f"{ratio(ink, WARM):8.2f}")

print()
print('/* generated by tools/design/ramps.py — do not hand-edit a stop */')
for name, (deep, bright, soft, ink) in out.items():
    print(f"  --ramp-{name}-deep:   {hexs(deep)};")
    print(f"  --ramp-{name}-bright: {bright.upper() if False else hexs(hex_to_rgb(ANCHORS[name][0]))};")
    print(f"  --ramp-{name}-soft:   {hexs(hex_to_rgb(ANCHORS[name][1]))};")
    print(f"  --ramp-{name}-ink:    {hexs(ink)};")
