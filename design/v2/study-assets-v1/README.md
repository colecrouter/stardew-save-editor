# Study-derived asset proof

This is an isolated design/material proof, not another application restyle.
The approved study remains the reference. Assets were generated with the built-in
image generation tool using that study as the reference, then copied here intact.
No raster resizing, redrawing, background replacement or palette conversion was
performed in scripts. `regions.json` records inspected atlas bounds for rendering.

## Assets

- `wood-frame.png`: transparent layered amber wood frame with shaded corner joinery.
- `icons.png`: transparent atlas of sixteen illustrated navigation/domain icons.
- `parchment.png`: clean warm paper texture, without UI baked into it.
- `proof.html`: local component sample, using those assets at UI sizes.

The generated assets reconstruct the study; they are not pixel-identical extractions.
They need optical-size and responsive composition validation before app adoption.
The current production SVG pictograms have not been replaced in this pass.

## Reference palette samples

Paper light #fcdea9; paper center #fddda8; paper shade #fad297;
control #fdedd7; header #fccc82; navigation #542710; export #1e8146.
These values are sampled from the approved study rather than game atlases.
Dark text and highlights vary within the source image; avoid presenting a single
sample as a complete palette or an accessibility audit.

## Generation briefs

All calls used the built-in image generator with the approved study as the input
reference. Frame and icon calls requested true transparency; paper is opaque.

Frame prompt: Extract/reconstruct one reusable rectangular production frame from
the study. Preserve rich amber orange wood, dark chocolate outlines, irregular
horizontal grain, layered amber bevels and chunky square corner joinery. Flat
orthographic geometry, consistent edge thickness, transparent empty center, no
UI/text/icons/paper/teal, no fixed internal dividers. Avoid thin nested gold lines,
flat SVG geometry, flat brown planks and plastic 3D shading. Compose dividers and
inset surfaces separately in code.

Icon prompt: One transparent 4x4 atlas, preserving the study's detailed illustrated
pixel art, rich shading/materials/silhouettes, dark outlines and warm highlights.
Rows: backpack/chest/face/shirt; heart/journal/hammer/pot;
farmer/leafy red barn/red-roof house/star; quest scroll/Qi gem/tree/chicken.
Equal cells and generous transparent gutters, no labels/frames/UI/backgrounds.
Consistent optical weight at 32?48 CSS pixels. No flat simplified pictograms or
reduced generic sixteen-color palette. Highlight the chest against dark wood.

Paper prompt: Reconstruct only the workspace's clean parchment, filling an opaque
square edge-to-edge. Predominantly #fddda8, pale #fce3b7, shaded #fad297. Extremely
subtle low-contrast organic cloudy mottling, consistent brightness at edges for
responsive panels. No wood, border, text, icons, dark corners, folds, stains,
distress or high-contrast yellow/orange patches.

## Pane and icon refinement

`proof-v2.html` keeps the approved raster outer frame. Header/workspace and selected
navigation use separate paper/shadow and nine-sliced edge layers from
`pane-edge.svg`. The workspace overlaps the vertical divider by about two pixels;
slightly asymmetric rounded corners and a small drop shadow belong to those
layers, with no radius/shadow on the content itself. Desktop and narrow previews
check composition; the original proof is retained for comparison.

`icons-soft.png` is a sibling candidate generated with the built-in image tool.
Its brief preserves all sixteen subjects and atlas ordering while reducing each
to roughly 24?32 logical pixels, broad shading clusters, quieter outlines and fewer
fine highlights, matching the original study's smaller sprites. The brief excludes
flat vector pictograms, glow and whole-image blur. `regions-soft.json` records its
inspected bounds. The sample uses browser resampling for the softer candidate and
lets readers switch to the original atlas at identical displayed sizes. It is a
comparison, not a claim that the aesthetic decision is settled.
