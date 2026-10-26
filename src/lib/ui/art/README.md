# Study-derived interface artwork

`icons.png` and `icon-regions.json` hold the softer illustrated atlas approved in
`design/v2/study-assets-v1`. `StudyIcon` preserves the inspected aspect ratio from
one shared atlas URL. Its display box must not be independently constrained to a
smaller width: doing that previously clipped icon right edges. Remaining action
and weather glyphs are temporary code assets.

Production frames use four directly editable PNGs: the user's original frame and
vertical/horizontal posts under `../frame/art/user/`, plus the consolidated
`../frame/art/parchment/frame.png`. CSS border-image slicing renders them at integer
3x scale. There are no generated pieces or required asset maintenance scripts.
See `design/v2/user-frame/README.md` and `design/v2/parchment/README.md` for slice
boundaries. Field and selected-tab treatments retain their earlier assets.
Vite bundles application URLs, including deployments under a base path.
