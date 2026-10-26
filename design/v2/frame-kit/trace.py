"""Trace structural parts from one common study grid; never modify its PNG."""

from collections import defaultdict
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
image = Image.open(ROOT / "reference-study.png").convert("RGB")
parts = {
    "outer-tl": (32, 40, 72, 100),
    "outer-tr": (1454, 40, 1504, 112),
    "outer-bl": (32, 936, 80, 988),
    "outer-br": (1456, 936, 1504, 988),
    "outer-top": (140, 40, 240, 64),
    "outer-bottom": (140, 960, 240, 988),
    "outer-left": (32, 180, 56, 240),
    "outer-right": (1480, 180, 1504, 240),
    "header-rail": (70, 132, 170, 160),
    "left-header-join": (32, 120, 70, 180),
    "right-header-join": (1468, 120, 1504, 188),
    "paper-tr": (1450, 144, 1488, 188),
    "nav-left": (48, 400, 64, 401),
    "nav-fill": (56, 940, 306, 941),
    "nav-right": (296, 400, 306, 401),
    "tab-fill": (220, 646, 221, 702),
    "upper-join": (286, 128, 350, 188),
    "lower-join": (286, 936, 350, 988),
    "post": (306, 240, 328, 320),
    "paper-top": (1050, 152, 1051, 176),
    "paper-bottom": (1050, 948, 1051, 968),
    "paper-left": (324, 400, 344, 401),
    "paper-right": (1468, 400, 1488, 401),
    "header-left": (52, 95, 70, 96),
    "tab-tl": (50, 646, 64, 666),
    "tab-tr": (286, 646, 306, 666),
    "tab-bl": (50, 682, 64, 702),
    "tab-br": (286, 682, 306, 702),
    "tab-top": (180, 646, 181, 656),
    "tab-bottom": (180, 692, 181, 702),
    "tab-left": (50, 666, 60, 667),
    "tab-right": (296, 666, 306, 667),
    "close": (1456, 52, 1498, 98),
}
samples = defaultdict(list)
for x0, y0, x1, y1 in parts.values():
    for y in range(y0, y1):
        for x in range(x0, x1):
            colour = image.getpixel((x, y))
            samples[tuple(c // 8 for c in colour)].append(colour)
colours = [(key, tuple(sum(p[i] for p in pixels) / len(pixels) for i in range(3)), len(pixels)) for key, pixels in samples.items()]


def distance(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(3))


centres = [max(colours, key=lambda entry: entry[2])[1]]
while len(centres) < 80:
    centres.append(max(colours, key=lambda entry: min(distance(entry[1], c) for c in centres) * entry[2] ** 0.3)[1])
for _ in range(10):
    groups = [[] for _ in centres]
    for entry in colours:
        groups[min(range(len(centres)), key=lambda i: distance(entry[1], centres[i]))].append(entry)
    centres = [tuple(sum(entry[1][i] * entry[2] for entry in group) / sum(entry[2] for entry in group) for i in range(3)) if group else centre for group, centre in zip(groups, centres)]
palette = [tuple(round(c) for c in centre) for centre in centres]
mapping = {entry[0]: min(range(len(palette)), key=lambda i: distance(entry[1], palette[i])) for entry in colours}

manifest = {}
for name, (x0, y0, x1, y1) in parts.items():
    paths = defaultdict(list)
    for y in range(y0, y1):
        x = x0
        while x < x1:
            colour = mapping[tuple(c // 8 for c in image.getpixel((x, y)))]
            end = x + 1
            while end < x1 and mapping[tuple(c // 8 for c in image.getpixel((end, y)))] == colour:
                end += 1
            paths[colour].append(f"M{x-x0} {y-y0}h{end-x}v1h{x-end}z")
            x = end
    body = "".join(f'<path fill="#{r:02x}{g:02x}{b:02x}" d="{"".join(paths[i])}"/>' for i, (r, g, b) in enumerate(palette) if paths[i])
    (ROOT / f"{name}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{x1-x0}" height="{y1-y0}" viewBox="0 0 {x1-x0} {y1-y0}" shape-rendering="crispEdges">{body}</svg>\n')
    manifest[name] = {"source": [x0, y0, x1, y1], "width": x1-x0, "height": y1-y0}
(ROOT / "parts.json").write_text(json.dumps(manifest, indent=2) + "\n")
