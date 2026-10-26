# Reference-traced junction study

Open `proof.html` directly, or serve this repository and open that file's URL.
The first row compares the supplied crop and its SVG trace at the same 198×192
display size. The second sample extends the rail, post and parchment edge while
keeping the junction's dimensions fixed. The width slider and seam toggle expose
the composition; they do not scale the art.

`reference-junction.png` is an unchanged copy of the user's supplied crop.
`trace.py` reads its colours, clusters them into 48 shades and writes horizontal
pixel-run paths on an integer SVG grid. This is a literal colour-cluster vector
trace, not a newly generated interpretation or a hand-redrawn decorative border.
The trace preserves the crop's shading and texture, with reduced colour precision.
The original image is never overwritten or modified.

The SVG parts use these source regions:

| Part               | Source bounds   | Display treatment                                         |
| ------------------ | --------------- | --------------------------------------------------------- |
| Junction           | 0,0–198,192     | Fixed 198×192; structural mask excludes surrounding fills |
| Rail               | 0,35–90,98      | Fixed 63px height; repeat horizontally                    |
| Post               | 96,125–138,192  | Fixed 42px width; repeat vertically                       |
| Paper top profile  | 190,84–191,125  | Fixed 41px height; repeat horizontally                    |
| Paper side profile | 138,160–178,161 | Fixed 40px width; repeat vertically                       |

This diagnostic sample uses the supplied crop's enlarged scale. It does not claim
that this is the final application's intended frame thickness. It is not yet a
complete frame kit: outer corners, other intersections, lower joins and the
selected navigation item still need their own reference-led treatment. Production
application code is deliberately untouched by this isolated tracing pass.

To reproduce the SVG trace, run `python design/v2/junction-trace/trace.py` with
Pillow available. This optional design tool is not part of the application build.
