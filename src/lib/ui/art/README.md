# Study-derived interface artwork

`icons.png` and `icon-regions.json` hold the softer illustrated atlas approved in
`design/v2/study-assets-v1`. `StudyIcon` preserves the inspected aspect ratio from
one shared atlas URL. Its display box must not be independently constrained to a
smaller width: doing that previously clipped icon right edges. Remaining action
and weather glyphs are temporary code assets.

Production wood sources and generated slices live in `../frame/art/user`, using
the user's original frame/post PNGs at integer 3x scale. See
`design/v2/user-frame/README.md` for editing and regeneration. The existing paper,
field and selected-tab treatments still use the earlier study extraction in
`../frame/art`; parchment refinement is deferred. Prior source references remain
in the design directories. Vite bundles application URLs, including deployments
under a base path.
