# Reference-traced frame kit

This is the earlier tracing/extraction proof. Its raster outputs are archived in
`raster-reference/` for comparison. Active wood, parchment and chrome now use the
single-file assets documented under `../user-frame/` and `../parchment/`.

`proof.html` assembles the outer corners, header rail intersections, central post,
lower joins, recessed parchment and selected navigation tab. Width/height controls
extend the composition without resizing the artwork. On narrow screens the
diagnostic canvas scrolls horizontally; it is not an app responsive-layout demo.

The source is the original approved 1536×1024 study, copied unchanged as
`reference-study.png`. The user's magnified crops identify the important joints,
but all parts use one common source grid to avoid mixing magnifications. The
accepted enlarged junction proof remains separately available in
`../junction-trace/`.

`trace.py` reads the structural regions, groups their colours into a common
80-shade palette, and exports integer-grid SVG pixel-run paths. It does not modify
the reference PNG. `parts.json` records every source rectangle and native size.
This is a literal colour-cluster trace with reduced colour precision, not a new
generated interpretation. Geometry and source-sized shading remain the reference.

The frame sample uses:

- Fixed, asymmetric outer corners with their original square joints and grain.
- Repeating horizontal rails and vertical posts, positioned on integer pixels.
- Thin paper-edge profiles behind the joins, sharing the same source coordinates.
- Structural masks that exclude flat interior areas from corner patches, allowing
  the header, navigation and parchment fills to continue independently.
- A separately assembled selected tab, with traced stepped corners and orange
  accents. Its left corners exclude the source barn icon; label content is HTML.
- A native close button over the matching corner position. Its art includes the
  local source context and is intended for that anchored location.

The gallery displays source details at exactly 2×, with pixelated sampling. The
main composition is 1×. The reference artwork includes its own sampled softness;
it is not sharpened or redrawn into uniform vector bevels.

## Archived raster extraction

The original PNG crops can be reproduced or verified with:

```powershell
python design/v2/frame-kit/export_rasters.py
python design/v2/frame-kit/export_rasters.py --check
```

Pillow is needed only for this optional design command. The exporter writes only
`raster-reference/`; it no longer writes assets or a TypeScript registry into the
application source. The archive contains 29 native PNGs (63,331 bytes) and a
manifest of source/output hashes, crop rectangles and dimensions. It performs no
resize, sharpening or colour quantization. Oxfmt owns manifest formatting, so
check mode compares manifest contents rather than whitespace.

The field and selected-tab reference borders were assembled from clean corner
crops and repeated edge strips. Their centres are transparent. Explicit masks
remove flat context around wood joints; close is separated from its corner.
`parts.json` and the exporter retain those source coordinates and masks.

The source SVG proof remains an isolated comparison and resize diagnostic, not
the responsive application. Its 22px post and 4px paper overlap are historical
geometry. Regenerate the SVG proof with `python design/v2/frame-kit/trace.py`.
The active UI instead uses the user's single-file wood kit, consolidated
parchment and reduced chrome with CSS border-image at 3x. See the current asset
READMEs and `docs/v2-integration-plan.md` for the foundation handoff.
