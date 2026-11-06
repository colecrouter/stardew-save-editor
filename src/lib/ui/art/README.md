# Interface artwork

Edit production PNGs directly; no extraction or regeneration scripts are required.
`StudyIcon` uses `icons.png` and `icon-regions.json`. Preserve each region's aspect
ratio; independently shrinking its width can clip the right edge. Weather sprites
have separate guidance in `weather/README.md`.

Frame artwork lives under `../frame/art`: user-authored wood/posts, parchment and
small chrome. Render logical pixels at integer 3x scale with pixelated sampling.
Vite resolves asset URLs under the deployment base path. Action/season glyphs remain
code-native. Historical studies and extraction sources remain in Git history.
