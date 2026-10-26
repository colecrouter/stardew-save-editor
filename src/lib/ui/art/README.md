# Study-derived interface artwork

`icons.png` and `icon-regions.json` hold the softer illustrated atlas approved in
`design/v2/study-assets-v1`. `StudyIcon` preserves the inspected aspect ratio from
one shared atlas URL. Its display box must not be independently constrained to a
smaller width: doing that previously clipped icon right edges. Remaining action
and weather glyphs are temporary code assets.

Production frame artwork lives in `../frame/art`, extracted at native resolution
from the approved original study. See `design/v2/frame-kit/README.md` for source
coordinates, masks, reproduction and validation. The earlier generated wood,
parchment and vector pane experiments remain in the design directory for reference
and are no longer shipped as production frame assets. Vite bundles all app URLs,
including deployments under a base path.
