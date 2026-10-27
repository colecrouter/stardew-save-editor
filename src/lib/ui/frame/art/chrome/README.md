# Small interface chrome

These are the directly editable prototype assets. Edit the PNGs in place; no
asset regeneration command is needed. All rendering uses integer 3x scaling.

| Asset              | Native size | CSS use                                                      |
| ------------------ | ----------- | ------------------------------------------------------------ |
| `panel.png`        | 12 x 12     | Four-pixel border slices rendered at 12px                    |
| `selected-tab.png` | 16 x 19     | 7/7/7/5 slices rendered at 21/21/21/15px, with filled centre |
| `close.png`        | 14 x 16     | 42 x 48px background within a 44 x 48px native button        |

The tab combines its former border and separate fill into one image; transparent
outer corners remain transparent. Panel borders paint behind the text. Image
rendering is pixelated, and the selected tab's natural minimum height is 57px.

These were reduced deterministically from the earlier study crops: whole 3px
blocks, twelve colours per image, binary alpha and no sharpening. The tab's 56px
source height was padded to 57px and the close image's 46px height to 48px before
reduction. The obsolete split crops and extraction tools have been removed; Git history
preserves them. The original study is `design/v2/references/study.png`. No new AI
art was generated.

Browser checks cover 320, 390, 768, 1280 and 1366px without horizontal page overflow,
long section labels, mobile navigation and keyboard activation of close. No
missing UI images or client runtime errors were observed. The icon atlas remains
unchanged in this pass.
