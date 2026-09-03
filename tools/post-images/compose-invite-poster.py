#!/usr/bin/env python3
"""
Telegram family-invite poster — code composition, no image-model generation.

Why: an image model can't take a real screenshot as input and place it into a
poster faithfully (it redraws the UI as a lossy guess) and its Persian text
render is broken (wrong joining/shaping, sometimes mirrored). Same failure
class that motivated compose.py's approach to the word-images counting
problem. So this composites three real assets with PIL + arabic_reshaper/
python-bidi for correct RTL shaping, exactly like compose.py draws its
numerals with a real font instead of asking a model to draw them:

  1. a real /child/home screenshot (apps/web, captured via Playwright —
     see chat history), committed here as assets/screenshot-raw.png
  2. one of the 20 illustrated story covers (tools/story-covers/output/),
     picked for warmth: "My Friends" (5f3bda7b...) — two kids embracing,
     big expressive faces, uncluttered background, reads at feed size.
     Read directly from tools/story-covers/output/ rather than duplicated
     into assets/, so there's one copy of that file in the repo.
  3. Vazirmatn (the app's own font, apps/web/src/app/layout.tsx) — a
     3-weight subset (Black/Bold/SemiBold + its OFL license) checked into
     fonts/vazirmatn/, since Pillow can't load the woff2 next/font serves
     and this needs the real TTF for raqm shaping. Full family/other
     scripts at https://github.com/rastikerdar/vazirmatn if more is ever
     needed.

Persian shaping/RTL: uses Pillow's built-in raqm text layout (HarfBuzz +
FriBidi under the hood — `direction="rtl"` + `anchor="ra"` on draw.text),
not the arabic_reshaper/python-bidi combo tried first. That combo emits
legacy Arabic Presentation-Forms codepoints, which Vazirmatn's cmap doesn't
map cleanly — letters came out unjoined and in the wrong order. raqm shapes
through the font's own OpenType init/medi/fina/liga tables, same as a
browser would, so it renders exactly like the app's own UI text.

Output: 1200x630 (matches the og:image / post_drafts.image_path convention).
Usage: python3 compose-invite-poster.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageFont, features

assert features.check('raqm'), (
    "Pillow was built without raqm — RTL Persian text will render as "
    "unjoined/reversed glyphs. Install a raqm-enabled Pillow (pip install "
    "--force-reinstall Pillow, or brew install libraqm first)."
)

W, H = 1200, 630
HERE = __file__.rsplit('/', 1)[0]
FONT_DIR = f"{HERE}/fonts/vazirmatn"
ASSETS = f"{HERE}/assets"
OUT = f"{HERE}/output"

BLACK_FONT = f"{FONT_DIR}/Vazirmatn-Black.ttf"
BOLD_FONT = f"{FONT_DIR}/Vazirmatn-Bold.ttf"
MED_FONT = f"{FONT_DIR}/Vazirmatn-SemiBold.ttf"

# Palette pulled from the app's own header gradient (screenshot) and the
# story cover's warm tones, not a generic "AI poster" palette.
BG_TOP = (255, 246, 232)      # #FFF6E8 warm cream
BG_BOTTOM = (255, 224, 179)   # #FFE0B3 soft peach
ACCENT = (230, 96, 15)        # #E6600F — the app's orange, darkened for text contrast
INK = (61, 41, 20)            # warm near-black, not pure black
CARD_WHITE = (255, 252, 246)


def rounded_shadow(size, radius, blur=24, opacity=90):
    w, h = size
    pad = blur * 2
    shadow = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=(0, 0, 0, opacity))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    return shadow, pad


def rounded(im, radius):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *im.size], radius=radius, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def vgradient(size, top, bottom):
    w, h = size
    im = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        im.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return im.resize((w, h))


def draw_rtl_lines(draw, lines, font, x_right, y_top, fill, line_gap=1.15):
    """Draw right-anchored RTL lines. `anchor='ra'` + `direction='rtl'` hands
    shaping to Pillow's raqm backend — pass plain logical-order text, no
    manual reshaping/reordering."""
    y = y_top
    ascent, descent = font.getmetrics()
    line_h = ascent + descent
    for line in lines:
        draw.text((x_right, y), line, font=font, fill=fill, direction='rtl', anchor='ra')
        y += int(line_h * line_gap)
    return y


def main():
    canvas = vgradient((W, H), BG_TOP, BG_BOTTOM).convert('RGBA')
    draw = ImageDraw.Draw(canvas)

    # --- soft decorative circle behind the phone panel, echoes the app's
    # own header (a pale disc peeking from behind the mascot) ---
    draw.ellipse([700, -120, 1180, 360], fill=(255, 214, 163, 140))

    # --- phone-framed screenshot, right-of-center ---
    shot = Image.open(f"{ASSETS}/screenshot-raw.png").convert('RGBA')
    shot = shot.crop((0, 0, shot.width, 930))  # clean region: header + friends row
    target_h = 560
    target_w = int(shot.width * target_h / shot.height)
    shot = shot.resize((target_w, target_h), Image.LANCZOS)
    shot = rounded(shot, 28)

    phone_x, phone_y = 760, 40
    shadow, pad = rounded_shadow(shot.size, 28, blur=20, opacity=70)
    canvas.alpha_composite(shadow, (phone_x - pad, phone_y - pad + 10))
    # white bezel
    bezel = Image.new('RGBA', (shot.width + 16, shot.height + 16), (0, 0, 0, 0))
    ImageDraw.Draw(bezel).rounded_rectangle([0, 0, *bezel.size], radius=34, fill=CARD_WHITE + (255,))
    canvas.alpha_composite(bezel, (phone_x - 8, phone_y - 8))
    canvas.alpha_composite(shot, (phone_x, phone_y))

    # --- story-cover art, bottom-left, tilted slightly for warmth ---
    # "My Friends" (5f3bda7b...) — read straight from tools/story-covers/output/
    # rather than duplicating the file into assets/, so it stays one source of truth.
    cover_path = f"{HERE}/../story-covers/output/5f3bda7b-b8c3-4914-a4d9-83e58eb00c70.png"
    cover = Image.open(cover_path).convert('RGBA')
    # crop to the two kids' faces — the most expressive, legible-at-small-size part
    cw, ch = cover.size
    cover = cover.crop((int(cw * 0.16), int(ch * 0.03), int(cw * 0.62), int(ch * 0.62)))
    cover = ImageOps.fit(cover, (300, 300), Image.LANCZOS)
    cover = rounded(cover, 24)
    cover = cover.rotate(-4, expand=True, resample=Image.BICUBIC)
    cx, cy = 50, H - cover.height - 34
    shadow, pad = rounded_shadow((300, 300), 24, blur=18, opacity=70)
    canvas.alpha_composite(shadow, (cx - pad + 10, cy - pad + 14))
    canvas.alpha_composite(cover, (cx, cy))

    # --- headline block, top-right-ish, RTL right-aligned ---
    right_edge = 700
    title_font = ImageFont.truetype(BLACK_FONT, 92)
    sub_font = ImageFont.truetype(BOLD_FONT, 40)
    tag_font = ImageFont.truetype(MED_FONT, 30)

    y = 70
    y = draw_rtl_lines(draw, ['کودک‌بوک'], title_font, right_edge, y, ACCENT, line_gap=1.0)
    y += 14
    y = draw_rtl_lines(
        draw,
        ['یادگیری فارسی', 'برای بچه‌های ۳ تا ۸ سال'],
        sub_font, right_edge, y, INK,
    )

    # --- free + no-ads reassurance, right-aligned under the headline block ---
    y += 24
    draw_rtl_lines(draw, ['رایگان، بدون تبلیغ 💛'], tag_font, right_edge, y, ACCENT)

    canvas = canvas.convert('RGB')
    import os
    os.makedirs(OUT, exist_ok=True)
    out_path = f"{OUT}/family-invite-poster.png"
    canvas.save(out_path, quality=95)
    print('wrote', out_path)


if __name__ == '__main__':
    main()
