# Logical-pixel parchment trial

The workspace rim is a lower-resolution derivative of the previous study crops.
Its 9-10px corners render at exactly 3x (27-30 CSS pixels), matching the logical
pixel density of the user-authored wood kit. Narrow profiles repeat on the same
grid. The broad parchment fill remains a CSS gradient rather than a tiled image.
The pane reserves six pixels below its content box for the rim outset, keeping
the bottom edge above the outer wood rail rather than hidden beneath it.
This first trial changes only `ParchmentPane`; field rims and selected tabs remain
unchanged so they can be evaluated separately.

`reduce.py` crops to whole 3x3 source blocks and area-reduces them without
sharpening. One shared twelve-colour palette avoids independently coloured seams;
alpha is binary and runtime rendering uses `image-rendering: pixelated`.
One-pixel source strips are reduced only across their profile, not along their
repeat axis. Every output dimension maps to exactly three CSS pixels per logical
pixel, with no fractional upscaling or browser smoothing.

Production outputs are in `src/lib/ui/frame/art/parchment/` (eight PNGs, 1,270 bytes).
Their manifest records crop rectangles, reduction factors, source/output hashes,
native dimensions and display scale. Existing source crops are preserved.

```powershell
python design/v2/parchment/reduce.py
python design/v2/parchment/reduce.py --check
```

Pillow is required only for this optional maintenance command. The application
uses committed files. Editing outputs directly is possible, but regeneration
will overwrite them. This is deterministic downsampling requested by the user;
no new AI-generated art was used.

Validated at 320, 390, 768, 1280 and 1366px: constant 3x image sizes, no horizontal
page overflow, stationary art while contents scroll, no missing UI assets or
client runtime errors. Native/Svelte checks, formatting and production build
pass; the configured Sentry upload still reports its existing HTTP 403.
