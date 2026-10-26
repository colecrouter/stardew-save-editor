# User-authored wood frame

The application directly consumes the user's three original PNGs in
`src/lib/ui/frame/art/user/`:

| Asset                 | Native size | CSS slicing                   | Display        |
| --------------------- | ----------- | ----------------------------- | -------------- |
| `frame.png`           | 55 x 45     | 10px on each side             | 30px corners   |
| `post.png`            | 7 x 50      | 7px top/bottom, filled middle | 21px wide/caps |
| `post-horizontal.png` | 43 x 7      | 7px left/right, filled middle | 21px high/caps |

Edit the PNGs directly. Vite reloads the changed source; no crop/export command,
Python dependency, or generated pieces are involved. Keep the cap/corner slices
intact if changing the canvas size. The originals are unchanged from the supplied
attachments. Earlier generated pieces and scripts remain available in Git history.

`StudyFrame` uses `border-image: ... 10 / 30px / 0 repeat`. The tenth pixel includes
the dark corner seam so it never repeats along the middle. Seven-pixel straight
timber renders at 21 CSS pixels. Transparent outer corners reveal the page.

`WoodDivider` uses the original post in one axis with `border-image-slice: 7 0 fill`
(vertical) or `0 7 fill` (horizontal). The centre repeats between fixed end caps;
it does not cover their transparent silhouettes. Every source pixel renders at
integer 3x with `image-rendering: pixelated`. Border-image owns tile placement;
there are no independently positioned corner or middle elements. Native-size
Chromium samples of opaque wood/post regions contain only source-image colours.

`EditorShell` retains the existing rail/post overlaps. Mobile substitutes a
horizontal rail for the vertical post. These are still rough structural assets;
material refinement can now be done in each original image.
