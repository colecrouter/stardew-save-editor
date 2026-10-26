"""Extract divider caps/middles without resizing the user-authored originals.

Requires Pillow only for this optional asset maintenance command.
Run with --check to verify generated PNGs; application builds use committed files.
"""
from io import BytesIO
from pathlib import Path
import sys
from PIL import Image

ART = Path(__file__).resolve().parents[3] / "src/lib/ui/frame/art/user"
regions = {
    "frame-tl": ("frame.png", (0, 0, 10, 10)),
    "frame-tr": ("frame.png", (45, 0, 55, 10)),
    "frame-bl": ("frame.png", (0, 35, 10, 45)),
    "frame-br": ("frame.png", (45, 35, 55, 45)),
    "frame-top": ("frame.png", (10, 0, 45, 7)),
    "frame-bottom": ("frame.png", (10, 38, 45, 45)),
    "frame-left": ("frame.png", (0, 10, 7, 35)),
    "frame-right": ("frame.png", (48, 10, 55, 35)),
    "post-top": ("post.png", (0, 0, 7, 7)),
    "post-middle": ("post.png", (0, 7, 7, 43)),
    "post-bottom": ("post.png", (0, 43, 7, 50)),
    "rail-left": ("post-horizontal.png", (0, 0, 7, 7)),
    "rail-middle": ("post-horizontal.png", (7, 0, 36, 7)),
    "rail-right": ("post-horizontal.png", (36, 0, 43, 7)),
}
output = ART / "parts"
output.mkdir(exist_ok=True)
for name, (source, rectangle) in regions.items():
    part = Image.open(ART / source).crop(rectangle)
    data = BytesIO()
    part.save(data, format="PNG", optimize=True)
    target = output / f"{name}.png"
    if "--check" in sys.argv:
        assert target.read_bytes() == data.getvalue(), f"Stale part: {name}"
    else:
        target.write_bytes(data.getvalue())
print(f"{'Verified' if '--check' in sys.argv else 'Extracted'} {len(regions)} native frame/divider parts")
