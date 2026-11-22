# Interface artwork

Use warm, restrained colors and crisp pixel clusters, with dark umber outlines,
upper-left lighting and shaded side planes. Aim for the tactile depth of
Stardew's objects; keep highlights selective and silhouettes readable.

Page icons use one compact subject with minimal texture. The application mark
can carry more detail: the barn establishes the farm theme, while the journal
and pencil communicate editing.

- [Page sprites](../../../../static/img/ui/pages/README.md): 32×32 transparent PNGs, rendered at native size.
- [Application mark](../../../../static/img/ui/brand/README.md): 128×128 transparent PNG, used on the upload
  page and in the editor header.
- [Weather sprites](weather/README.md): game-derived forecast artwork.

Edit production PNGs directly; no regeneration step is needed. Page sprites and
the app mark live in `static/img/ui` and use SvelteKit's `asset()` for the deployment
base, without a custom path registry or runtime manifest lookup.

Calendar event markers reuse the game's calendar flag, Rainbow Trout and
Stardew Valley Almanac atlas regions in `CalendarMonth.svelte`. They share the
portraits' 32px desktop and 24px phone bounds and retain labelled event details.

`StudyIcon` prefers page sprites over matching regions in `icons.png` and
`icon-regions.json`. Preserve atlas regions' aspect ratios to avoid clipping.
Action and season glyphs remain code-native.

Frame artwork lives under `../frame/art`. Preserve its transparent corners and
caps, and render logical pixels at integer 3× scale with pixelated sampling.
