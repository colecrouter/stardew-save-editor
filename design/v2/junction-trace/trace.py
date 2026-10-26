"""Read-only colour analysis of the supplied crop; export integer-grid SVG traces.

The reference PNG is never modified. SVG parts retain source coordinates and are
displayed at source size; extending rails/posts uses repetition, not scaling.
"""

from collections import defaultdict
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
image = Image.open(ROOT / "reference-junction.png").convert("RGB")
pixels = list(image.get_flattened_data())
buckets = defaultdict(list)
for pixel in pixels:
    buckets[tuple(channel // 8 for channel in pixel)].append(pixel)
colours = []
for key, values in buckets.items():
    colours.append((key, tuple(sum(p[i] for p in values) / len(values) for i in range(3)), len(values)))


def distance(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(3))


centres = [max(colours, key=lambda entry: entry[2])[1]]
while len(centres) < 48:
    centres.append(max(colours, key=lambda entry: min(distance(entry[1], c) for c in centres) * entry[2] ** 0.3)[1])
for _ in range(10):
    groups = [[] for _ in centres]
    for entry in colours:
        groups[min(range(len(centres)), key=lambda i: distance(entry[1], centres[i]))].append(entry)
    centres = [tuple(sum(entry[1][i] * entry[2] for entry in group) / sum(entry[2] for entry in group) for i in range(3)) if group else centre for group, centre in zip(groups, centres)]
palette = [tuple(round(c) for c in centre) for centre in centres]
mapping = {entry[0]: min(range(len(palette)), key=lambda i: distance(entry[1], palette[i])) for entry in colours}
grid = [mapping[tuple(c // 8 for c in pixel)] for pixel in pixels]


def export(name, box):
    x0, y0, x1, y1 = box
    paths = defaultdict(list)
    for y in range(y0, y1):
        x = x0
        while x < x1:
            colour = grid[y * image.width + x]
            end = x + 1
            while end < x1 and grid[y * image.width + end] == colour:
                end += 1
            paths[colour].append(f"M{x-x0} {y-y0}h{end-x}v1h{x-end}z")
            x = end
    body = "".join(f'<path fill="#{r:02x}{g:02x}{b:02x}" d="{"".join(paths[i])}"/>' for i, (r, g, b) in enumerate(palette) if paths[i])
    (ROOT / name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{x1-x0}" height="{y1-y0}" viewBox="0 0 {x1-x0} {y1-y0}" shape-rendering="crispEdges">{body}</svg>\n')


export("junction.svg", (0, 0, 198, 192))
export("rail.svg", (0, 35, 90, 98))
export("post.svg", (96, 125, 138, 192))
export("paper-top.svg", (190, 84, 191, 125))
export("paper-side.svg", (138, 160, 178, 161))
