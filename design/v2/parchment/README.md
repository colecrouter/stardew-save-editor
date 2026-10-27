# Single-file logical-pixel parchment

Edit `src/lib/ui/frame/art/parchment/frame.png` directly. This 39 x 39 PNG is the
canonical workspace rim. No extraction, reduction or regeneration step is needed.
Vite picks up edits through the normal asset import.

The image consolidates the previously approved reduced crops without resizing,
recolouring or sharpening. They retain their shared twelve-colour palette and
binary alpha. Earlier crops and the one-time reduction recipe remain in Git history.

CSS uses asymmetric source slices of **10 top, 10 right, 9 bottom, 9 left**, rendered
as **30, 30, 27, 27 CSS pixels**. Thus every corner/profile retains integer 3x scale.
The twenty-pixel middle sections repeat; the transparent centre is not filled by
the image. The broad parchment fill remains a CSS gradient.

The pane reserves six pixels below its content box for the rim outset, keeping
the bottom edge above the outer wood rail. The decorative layer stays outside the
scrollable content. Small panel borders remain behind text.

Only the main workspace uses this parchment frame; smaller field and selected-tab
borders retain their existing assets. The original study source is preserved in
`../references/study.png`. This asset was assembled deterministically from existing pieces;
no new AI-generated art was used.
