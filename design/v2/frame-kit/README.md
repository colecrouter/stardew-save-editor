# Reference-traced frame kit

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

## Production extraction and use

The application uses native PNG crops of this same reference, rather than
rasterizing the colour-clustered SVG proof. Run:

```powershell
python design/v2/frame-kit/export_rasters.py
python design/v2/frame-kit/export_rasters.py --check
```

Pillow is required only to reproduce/check the design assets. The app build uses
checked-in PNGs and requires neither Python nor Pillow. No resize, sharpening,
colour quantization or fractional sampling occurs during extraction. The current
29 PNGs total 63,331 bytes. `src/lib/ui/frame/art/manifest.json` records the source
hash, crop rectangles (or named assembly), native dimensions and each PNG hash.
The exporter checks image bytes and manifest contents; Oxfmt owns TS/JSON formatting.

The field border and selected-tab border are assembled from native corner crops
and clean repeated edge strips. Their transparent centres contain no labels or
controls. Do not repeat the calendar panel's entire original side: its inner grid
lines would contaminate the rim. Explicit masks remove flat context around shared
wood joints; the outer top-right corner excludes the separately anchored close
button. `parts.json` and the exporter retain the source coordinates and masks.

The production components are `StudyFrame` (outer art), `EditorShell` (joined
header/navigation/workspace), `ParchmentPane` (rim independent of scrolling), and
`SectionLink` (native link with selected artwork behind its label). Corners render
at native size; horizontal/vertical strips repeat without `background-size`,
transforms, or stretching. The navigation post is 22px wide. Its upper/lower caps
begin 20px before the post; parchment overlaps the post by 4px. These offsets are
source join geometry, not padding adjustments on individual pages.

Below 900px the vertical post becomes a horizontal rail, navigation becomes a
native disclosure, and content uses document flow. Desktop keeps the frame within
the viewport and scrolls content/navigation separately. Footer farmer selection
belongs inside the workspace, so multiplayer does not extend the frame.

The source SVG proof remains a useful isolated comparison and resize diagnostic;
it is not the responsive app. Regenerate it with `python design/v2/frame-kit/trace.py`.
