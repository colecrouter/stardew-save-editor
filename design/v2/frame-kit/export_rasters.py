"""Extract production PNGs without scaling, filtering, or colour quantization.

Run normally to export, or with --check to verify checked-in outputs. Pillow is
only needed for this optional design command, never for the application build.
"""

from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw

SOURCE = Path(__file__).with_name("reference-study.png")
OUTPUT = Path(__file__).with_name("raster-reference")
image = Image.open(SOURCE).convert("RGBA")
regions = json.loads(Path(__file__).with_name("parts.json").read_text())
names = ["outer-tl", "outer-tr", "outer-bl", "outer-br", "outer-top", "outer-bottom", "outer-left", "outer-right", "header-rail", "left-header-join", "right-header-join", "upper-join", "lower-join", "post", "paper-top", "paper-bottom", "paper-left", "paper-right", "header-left", "nav-left", "nav-right", "close", "tab-fill"]
regions.update({
    "workspace-tl": {"source": [320, 152, 348, 180]},
    "workspace-tr": {"source": [1456, 152, 1488, 184]},
    "workspace-bl": {"source": [320, 940, 348, 968]},
    "workspace-br": {"source": [1456, 940, 1488, 968]},
})
names += ["workspace-tl", "workspace-tr", "workspace-bl", "workspace-br"]
polygons = {
    "outer-bl": [(0, 0), (24, 0), (24, 24), (48, 24), (48, 52), (0, 52)],
    "outer-br": [(12, 0), (48, 0), (48, 52), (0, 52), (0, 12), (12, 12)],
    "left-header-join": [(0, 0), (38, 0), (38, 40), (24, 40), (24, 60), (0, 60)],
    "right-header-join": [(0,0),(36,0),(36,68),(12,68),(12,40),(0,40)],
    "upper-join": [(0, 4), (64, 4), (64, 48), (48, 48), (48, 60), (18, 60), (18, 40), (0, 40)],
    "lower-join": [(18, 0), (48, 0), (48, 12), (64, 12), (64, 52), (0, 52), (0, 28), (18, 28)],
}


def extract(name):
    result = image.crop(regions[name]["source"])
    if name in polygons:
        mask = Image.new("L", result.size)
        ImageDraw.Draw(mask).polygon(polygons[name], fill=255)
        result.putalpha(mask)
    if name.startswith("outer-"):
        for y in range(result.height):
            for x in range(result.width):
                r, g, b, a = result.getpixel((x, y))
                if g > r and b > r:  # Teal exterior, not the brown frame shadow.
                    result.putpixel((x, y), (r, g, b, 0))
    if name == "outer-tr":
        # The close control is its own anchored native button, not corner ink.
        ImageDraw.Draw(result).rectangle((2, 12, 43, 57), fill=(0, 0, 0, 0))
    return result


outputs = {name: extract(name) for name in names}
# A small repeated border assembled from clean tab samples. Its centre is empty;
# no source icon or label pixels can enter a production section link.
tab = Image.new("RGBA", (48, 56))
for name, point in [("tab-tl", (0, 0)), ("tab-tr", (28, 0)), ("tab-bl", (0, 36)), ("tab-br", (28, 36))]:
    tab.paste(image.crop(regions[name]["source"]), point)
for x in range(14, 28):
    tab.paste(image.crop((220, 646, 221, 666)), (x, 0))
    tab.paste(image.crop((220, 682, 221, 702)), (x, 36))
tab.paste(image.crop((50, 666, 64, 682)), (0, 20))
tab.paste(image.crop((286, 666, 306, 682)), (28, 20))
outputs["section-border"] = tab

# Clean 12px corners with uncontaminated edge strips. Calendar grid lines
# begin inside the source rim, so never repeat the full source side perimeter.
field = Image.new("RGBA", (36, 36))
for rectangle, point in [
    ((801,319,813,331),(0,0)), ((1204,319,1216,331),(24,0)),
    ((801,703,813,715),(0,24)), ((1204,703,1216,715),(24,24)),
]:
    field.paste(image.crop(rectangle), point)
for n in range(12,24):
    field.paste(image.crop((1000,319,1001,331)), (n,0))
    field.paste(image.crop((1000,703,1001,715)), (n,24))
    field.paste(image.crop((801,340,813,341)), (0,n))
    field.paste(image.crop((1204,340,1216,341)), (24,n))
outputs["field-border"] = field

manifest = {"version": 1, "sourceSha256": sha256(SOURCE.read_bytes()).hexdigest(), "parts": {}}
files = {}
for name, result in outputs.items():
    encoded = BytesIO()
    result.save(encoded, format="PNG", optimize=True)
    data = encoded.getvalue()
    files[f"{name}.png"] = data
    manifest["parts"][name] = {"width": result.width, "height": result.height, "sha256": sha256(data).hexdigest(), **({"source": regions[name]["source"]} if name in regions else {"assembly": name})}
files["manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
# Oxfmt may reformat the manifest; check its semantic contents.
OUTPUT.mkdir(parents=True, exist_ok=True)
check = "--check" in sys.argv
for name, data in files.items():
    target = OUTPUT / name
    if check:
        if name == "manifest.json":
            assert json.loads(target.read_text()) == manifest, "Frame manifest is stale"
        else:
            assert target.read_bytes() == data, f"Stale or changed frame asset: {name}"
    else:
        target.write_bytes(data)
print(f'{"Verified" if check else "Exported"} {len(outputs)} native-size PNGs ({sum(len(v) for k,v in files.items() if k.endswith(".png")):,} bytes)')
