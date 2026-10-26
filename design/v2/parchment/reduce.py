"""Reduce existing study rim crops to the wood kit's logical pixel density.

Explicit 3:1 area reduction, then one shared 12-colour palette. No sharpening.
Python/Pillow are optional maintenance tools; the app consumes committed PNGs.
"""
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "src/lib/ui/frame/art"
OUTPUT = SOURCE / "parchment"
# Crop to whole 3x3 blocks, keeping each corner's outside edges. Strips have
# only one source pixel along their repeat axis, so reduce the profile axis only.
regions = {
    "tl": ("workspace-tl", (0,0,27,27), (3,3)),
    "tr": ("workspace-tr", (2,0,32,30), (3,3)),
    "bl": ("workspace-bl", (0,1,27,28), (3,3)),
    "br": ("workspace-br", (2,1,32,28), (3,3)),
    "top": ("paper-top", (0,0,1,24), (1,3)),
    "bottom": ("paper-bottom", (0,2,1,20), (1,3)),
    "left": ("paper-left", (0,0,18,1), (3,1)),
    "right": ("paper-right", (2,0,20,1), (3,1)),
}
reduced = {}
inputs = {}
for name, (source, rectangle, factor) in regions.items():
    path = SOURCE / f"{source}.png"
    reduced[name] = Image.open(path).convert("RGBA").crop(rectangle).reduce(factor)
    inputs[name] = {"source":source,"sha256":sha256(path.read_bytes()).hexdigest(),"crop":rectangle,"reduction":factor}
# One palette for all pieces avoids independently quantized corner/edge seams.
samples = [pixel[:3] for part in reduced.values() for y in range(part.height) for x in range(part.width) for pixel in [part.getpixel((x,y))] if pixel[3] >= 128]
strip = Image.new("RGB", (len(samples),1));strip.putdata(samples)
palette = strip.quantize(colors=12, method=Image.Quantize.MEDIANCUT)
outputs = {}
for name, part in reduced.items():
    result = part.convert("RGB").quantize(palette=palette,dither=Image.Dither.NONE).convert("RGBA")
    result.putalpha(part.getchannel("A").point(lambda a:255 if a>=128 else 0))
    outputs[name] = result
manifest = {"displayScale":3,"paletteSize":12,"parts":{}}
OUTPUT.mkdir(exist_ok=True)
check = "--check" in sys.argv
for name, result in outputs.items():
    data = BytesIO();result.save(data,format="PNG",optimize=True)
    target = OUTPUT / f"{name}.png"
    manifest["parts"][name] = {**inputs[name],"width":result.width,"height":result.height,"sha256":sha256(data.getvalue()).hexdigest()}
    if check:
        assert target.read_bytes() == data.getvalue(), f"Changed parchment part: {name}"
    else:
        target.write_bytes(data.getvalue())
if check:
    assert json.loads((OUTPUT/"manifest.json").read_text()) == json.loads(json.dumps(manifest)), "Stale parchment manifest"
else:
    (OUTPUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print(f"{'Verified' if check else 'Reduced'} {len(outputs)} parchment parts; corners 9-10 native pixels, display scale 3x")
