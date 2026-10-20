"""Generate transparent Atacadista Silva PNG logo variants from the supplied mark concept.

Requires Pillow: python -m pip install Pillow
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web" / "public" / "brand"
MOBILE = ROOT / "apps" / "mobile" / "assets"
BLACK = (9, 9, 9, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)


def font(size: int, heavy: bool = False):
    names = [r"C:\Windows\Fonts\ariblk.ttf", r"C:\Windows\Fonts\arialbd.ttf"] if heavy else [r"C:\Windows\Fonts\arial.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def draw_badge(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, light: bool = False):
    scale = size / 220
    def pts(points):
        return [(round(x + px * scale), round(y + py * scale)) for px, py in points]
    outer = [(36, 0), (184, 0), (184, 12), (197, 25), (210, 25), (210, 179), (197, 179), (184, 192), (184, 204), (36, 204), (36, 192), (23, 179), (10, 179), (10, 25), (23, 25), (36, 12)]
    inner = [(42, 9), (178, 9), (178, 17), (193, 32), (201, 32), (201, 174), (193, 174), (178, 189), (178, 197), (42, 197), (42, 189), (27, 174), (19, 174), (19, 32), (27, 32), (42, 17)]
    inset = [(49, 19), (171, 19), (171, 22), (188, 39), (191, 39), (191, 167), (188, 167), (171, 184), (171, 187), (49, 187), (49, 184), (32, 167), (29, 167), (29, 39), (32, 39), (49, 22)]
    if light:
        draw.line(pts(outer + [outer[0]]), fill=WHITE, width=max(5, round(6 * scale)), joint="curve")
        draw.line(pts(inner + [inner[0]]), fill=WHITE, width=max(2, round(2 * scale)), joint="curve")
        monogram = WHITE
    else:
        draw.polygon(pts(outer), fill=BLACK)
        draw.line(pts(inner + [inner[0]]), fill=WHITE, width=max(3, round(4 * scale)), joint="curve")
        draw.line(pts(inset + [inset[0]]), fill=WHITE, width=max(1, round(2 * scale)), joint="curve")
        monogram = WHITE
    label_font = font(round(size * 0.49), heavy=True)
    draw.text((x + size * 0.5, y + size * 0.59), "AS", font=label_font, fill=monogram, anchor="mm", stroke_width=max(0, round(size / 500)), stroke_fill=monogram)


def draw_wordmark(draw: ImageDraw.ImageDraw, text: str, box: tuple[int, int, int, int], color, font_size: int):
    left, top, right, bottom = box
    while True:
        typeface = font(font_size, heavy=True)
        spacing = max(1, font_size // 24)
        widths = [draw.textlength(char, font=typeface) for char in text]
        total = sum(widths) + spacing * (len(text) - 1)
        if total <= right - left or font_size <= 24:
            break
        font_size -= 2
    x = left + (right - left - total) / 2
    y = top + (bottom - top - font_size) / 2 - font_size * 0.05
    for char, width in zip(text, widths):
        draw.text((round(x), round(y)), char, font=typeface, fill=color)
        x += width + spacing


def full_logo(path: Path, size: tuple[int, int], mark_box: tuple[int, int, int], word_box: tuple[int, int, int, int], light: bool = False):
    image = Image.new("RGBA", size, TRANSPARENT)
    draw = ImageDraw.Draw(image)
    x, y, mark_size = mark_box
    draw_badge(draw, x, y, mark_size, light)
    draw_wordmark(draw, "ATACADISTA SILVA", word_box, WHITE if light else BLACK, max(36, size[0] // 16))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def main():
    MOBILE.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    icon = Image.new("RGBA", (1024, 1024), TRANSPARENT)
    draw_badge(ImageDraw.Draw(icon), 82, 82, 860)
    icon.save(MOBILE / "icon.png", optimize=True)
    full_logo(WEB / "atacadista-silva.png", (1200, 1200), (390, 70, 420), (60, 640, 1140, 810))
    full_logo(MOBILE / "logo-full.png", (1200, 1200), (390, 70, 420), (60, 640, 1140, 810))
    full_logo(WEB / "atacadista-silva-clara.png", (1200, 1200), (390, 70, 420), (60, 640, 1140, 810), light=True)
    full_logo(MOBILE / "logo-full-light.png", (1200, 1200), (390, 70, 420), (60, 640, 1140, 810), light=True)
    horizontal = Image.new("RGBA", (1600, 520), TRANSPARENT)
    draw = ImageDraw.Draw(horizontal)
    draw_badge(draw, 70, 70, 380)
    draw_wordmark(draw, "ATACADISTA SILVA", (490, 145, 1550, 385), BLACK, 96)
    horizontal.save(WEB / "atacadista-silva-horizontal.png", optimize=True)
    symbol = Image.new("RGBA", (1024, 1024), TRANSPARENT)
    draw_badge(ImageDraw.Draw(symbol), 72, 72, 880)
    symbol.save(WEB / "atacadista-silva-simbolo.png", optimize=True)


if __name__ == "__main__":
    main()
