# User-authored wood frame

The current outer frame and inner posts use the user's three original PNGs,
copied byte-for-byte into `src/lib/ui/frame/art/user/`:

- `frame.png`: 55 by 45 pixels.
- `post.png`: 7 by 50 pixels.
- `post-horizontal.png`: 43 by 7 pixels.

Edit those originals, then regenerate their production slices:

```powershell
python design/v2/user-frame/extract.py
python design/v2/user-frame/extract.py --check
```

Pillow is needed only for this optional maintenance command. The application uses
committed PNGs; its build requires neither Python nor Pillow. Files under `parts/`
are generated and will be overwritten. The script only crops; it does not resize,
sharpen, quantize, or repaint the supplied artwork.

`StudyFrame` renders ten-pixel corner patches at exactly 3x (30 CSS pixels). The
corner includes the dark seam at source coordinate 9; including that seam in a
repeated edge would create spurious black lines. Straight timber is seven source
pixels thick (21 CSS pixels). Clean edge strips repeat from top-left origins,
without centred tile placement or fractional scaling. Original transparent corners
remain transparent against the page background.

`WoodDivider` uses seven-pixel end caps, rendered once at each end. Its middles
repeat independently at 3x: 87 by 21 CSS pixels horizontally and 21 by 108 vertically.
The middle does not paint under the transparent end-cap silhouettes.

`EditorShell` overlaps rail caps 9 CSS pixels onto the outside wood. The vertical
post begins 12 pixels into the header rail and ends 9 pixels into the bottom wood.
On mobile the vertical post is replaced by a horizontal rail. These joints are a
first structural pass with the supplied rough art; material polish is deferred.

Parchment, field rims, selected navigation tabs and icons are unchanged by this
pass. The original study extraction remains in `../frame-kit/` as a prior proof.
