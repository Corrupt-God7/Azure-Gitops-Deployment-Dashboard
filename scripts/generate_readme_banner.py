from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH, HEIGHT = 1200, 360
BACKGROUND = (6, 16, 29)
PANEL = (11, 29, 48)
BORDER = (29, 60, 84)
MUTED = (113, 143, 170)
TEXT = (238, 247, 255)
CYAN = (56, 189, 248)
TEAL = (45, 212, 191)
STAGES = ["Developer", "GitHub", "Actions", "ACR", "Argo CD", "AKS"]

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "assets" / "gitops-pipeline.gif"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def rounded_gradient() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    pixels = image.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            radial = max(0.0, 1.0 - math.hypot(x - 930, y - 20) / 620)
            pixels[x, y] = (
                int(BACKGROUND[0] + radial * 4),
                int(BACKGROUND[1] + radial * 23),
                int(BACKGROUND[2] + radial * 35),
            )
    return image


def add_glow(image: Image.Image, box: tuple[int, int, int, int], color: tuple[int, int, int], radius: int = 18) -> None:
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.rounded_rectangle(box, radius=16, outline=(*color, 180), width=5)
    glow = glow.filter(ImageFilter.GaussianBlur(radius))
    image.paste(glow, (0, 0), glow)


def frame_at(frame_number: int) -> Image.Image:
    image = rounded_gradient().convert("RGBA")
    draw = ImageDraw.Draw(image)

    for x in range(30, WIDTH, 54):
        for y in range(24, HEIGHT, 54):
            draw.ellipse((x, y, x + 2, y + 2), fill=(44, 77, 105, 105))

    draw.text((56, 42), "GITOPS DEPLOYMENT DASHBOARD", font=font(34, True), fill=TEXT)
    draw.text((58, 91), "BUILD  /  SHIP  /  RECONCILE  /  OBSERVE  /  RECOVER", font=font(15, True), fill=(91, 154, 191))

    active = (frame_number // 5) % len(STAGES)
    pulse = (math.sin(frame_number * 0.65) + 1) / 2
    node_width, node_height, gap = 158, 74, 29
    start_x, y = 44, 174

    centers: list[tuple[int, int]] = []
    for index in range(len(STAGES)):
        x = start_x + index * (node_width + gap)
        centers.append((x + node_width // 2, y + node_height // 2))

    for index in range(len(STAGES) - 1):
        x1 = centers[index][0] + node_width // 2
        x2 = centers[index + 1][0] - node_width // 2
        line_color = TEAL if index < active else (41, 74, 99)
        draw.line((x1, centers[index][1], x2, centers[index][1]), fill=line_color, width=3)
        draw.polygon(
            [(x2, centers[index][1]), (x2 - 8, centers[index][1] - 5), (x2 - 8, centers[index][1] + 5)],
            fill=line_color,
        )

    for index, label in enumerate(STAGES):
        x = start_x + index * (node_width + gap)
        box = (x, y, x + node_width, y + node_height)
        is_active = index == active
        is_complete = index < active
        if is_active:
            add_glow(image, box, CYAN, int(12 + pulse * 7))
        fill = (14, 43, 65) if is_active else PANEL
        outline = CYAN if is_active else (TEAL if is_complete else BORDER)
        draw.rounded_rectangle(box, radius=14, fill=fill, outline=outline, width=2)
        marker = TEAL if is_complete else (CYAN if is_active else (70, 99, 125))
        draw.ellipse((x + 17, y + 27, x + 31, y + 41), fill=marker)
        label_box = draw.textbbox((0, 0), label, font=font(16, True))
        label_width = label_box[2] - label_box[0]
        draw.text((x + 42, y + 25), label, font=font(16, True), fill=TEXT if is_active or is_complete else MUTED)
        if label_width > 100:
            draw.text((x + 42, y + 46), "ready", font=font(10), fill=MUTED)

    progress_x1, progress_x2, progress_y = 56, WIDTH - 56, 301
    draw.rounded_rectangle((progress_x1, progress_y, progress_x2, progress_y + 7), radius=4, fill=(21, 45, 65))
    progress = (active + pulse) / len(STAGES)
    draw.rounded_rectangle((progress_x1, progress_y, progress_x1 + int((progress_x2 - progress_x1) * progress), progress_y + 7), radius=4, fill=TEAL)
    draw.text((56, 322), "Git is the source of truth", font=font(12, True), fill=(94, 187, 196))
    draw.text((WIDTH - 296, 322), "AUTOMATED  |  OBSERVABLE  |  RECOVERABLE", font=font(11, True), fill=(82, 117, 145))
    return image.convert("P", palette=Image.Palette.ADAPTIVE, colors=128)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frames = [frame_at(index) for index in range(30)]
    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=110,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
