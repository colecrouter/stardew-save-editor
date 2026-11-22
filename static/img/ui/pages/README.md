# Page navigation sprites

Use compact, dimensional objects: a strong silhouette, limited earthy palette,
upper-left highlights and a darker side or recessed area. Suggest depth through
overlaps and distinct planes; avoid fine texture and glossy shading.

Each file is a **32×32 transparent PNG**. Keep a consistent apparent size and
center within the square canvas. Navigation renders at 32px; smaller secondary
controls use pixelated sampling.

Filenames match the page icon names in `src/lib/ui/studyIcons.ts`; Storage and
Recipes use `chests` and `cooking`. `StudyIcon.svelte` resolves them directly with
SvelteKit's `asset()`. Replace PNGs in place; no atlas rebuild is needed.
