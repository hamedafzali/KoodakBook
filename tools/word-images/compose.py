"""
Deterministic compositing for concepts SDXL cannot reliably render on its own
— currently: exact counts for number words. Diffusion models don't count;
asking for "exactly three stars" or a numeral glyph in the prompt is asking
the model to do something it structurally can't do reliably, and drawing a
numeral is also asking it to render text, which fights every other word's
"no text" requirement.

Approach: SDXL generates ONE instance of a simple sticker object (no count,
no numeral, plain background). This module cuts that sticker out of its
background, then composites the exact requested count of copies onto a
fresh canvas alongside a numeral drawn with a real font — so the count and
the digit are both correct by construction, not by hoping the model got it
right.
"""
import math
from PIL import Image, ImageDraw, ImageFont

NUMERAL_FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"


def _color_distance(a, b) -> float:
    return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))


def cutout_sticker(path: str, bg_tolerance: int = 40) -> Image.Image:
    """Load a sticker image generated on a plain background and key out that
    background to transparency, then crop to the sticker's content."""
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    bg_color = tuple(
        sum(pixels[c][ch] for c in corners) // 4 for ch in range(3)
    )

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            dist = _color_distance((r, g, b), bg_color)
            if dist < bg_tolerance:
                pixels[x, y] = (r, g, b, 0)
            elif dist < bg_tolerance * 2:
                fade = (dist - bg_tolerance) / bg_tolerance
                pixels[x, y] = (r, g, b, int(255 * fade))

    bbox = img.getbbox()
    if bbox:
        pad = 10
        bbox = (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(w, bbox[2] + pad),
            min(h, bbox[3] + pad),
        )
        img = img.crop(bbox)
    return img


def compose_count_image(
    sticker: Image.Image,
    count: int,
    background_hex: str,
    numeral_text: str,
    numeral_fill_hex: str,
    numeral_outline_hex: str,
    out_path: str,
    canvas_size: int = 1024,
) -> None:
    canvas = Image.new("RGBA", (canvas_size, canvas_size), background_hex)

    font_size = int(canvas_size * 0.32)
    font = ImageFont.truetype(NUMERAL_FONT_PATH, font_size)
    draw = ImageDraw.Draw(canvas)
    numeral_y = int(canvas_size * 0.08)
    bbox = draw.textbbox((0, 0), numeral_text, font=font, stroke_width=font_size // 18)
    numeral_w = bbox[2] - bbox[0]
    numeral_x = (canvas_size - numeral_w) // 2 - bbox[0]
    draw.text(
        (numeral_x, numeral_y),
        numeral_text,
        font=font,
        fill=numeral_fill_hex,
        stroke_width=font_size // 18,
        stroke_fill=numeral_outline_hex,
    )

    sticker_size = int(canvas_size * 0.16)
    ratio = sticker_size / max(sticker.size)
    resized = sticker.resize(
        (max(1, int(sticker.size[0] * ratio)), max(1, int(sticker.size[1] * ratio))),
        Image.LANCZOS,
    )

    gap = int(canvas_size * 0.06)
    row_width = count * resized.size[0] + (count - 1) * gap
    start_x = (canvas_size - row_width) // 2
    row_y = int(canvas_size * 0.58)

    for i in range(count):
        x = start_x + i * (resized.size[0] + gap)
        canvas.alpha_composite(resized, (x, row_y))

    canvas.convert("RGB").save(out_path)
