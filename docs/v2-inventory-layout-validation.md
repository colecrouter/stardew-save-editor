# Inventory layout stability

This pass addresses #218's Inventory selection/inspector stability requirement.
It does not redesign the phone navigation or claim a general performance audit.

## Reproduction and result

On the previous layout at 1440×1000, select an empty backpack slot, scroll the
picker to the bottom, then select an occupied slot such as Rusty Sword. The
inspector's shorter content shrinks the shared parchment scroll range: the
measured outer scroll position changed from 370px to 85px. The unchanged grids
therefore moved 285px.

Above 1150px, Inventory now takes the parchment's available content height and
gives possessions and details independent scroll areas. The inspector reserves
its scrollbar lane; choosing a new slot resets only the inspector's reading
position. Model revisions from ordinary edits leave reading positions intact.
The touch-drag controller starts edge scrolling at the actual possessions pane,
while its broader root still authorizes both backpack and chest hit targets.

At 1150px and below, Inventory retains the stacked page flow and explicit
**Selected item** link. Those layouts do not use independent inventory panes;
legitimate content-height changes remain part of their document flow.

## Production-browser checks

Checked in macOS Chromium using a full-save-derived fixture with equipment,
placed chests, a 36-slot host and a 12-slot farmhand. Viewport sizes below are CSS
pixels, not native-device qualifications.

| Scenario                                                 | Observed result                                                                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440×1000, scrolled picker → sword                       | Slot 1 stayed at x287/y475.890625, 52.25px square; outer/possessions scroll remained 0. Inspector reset to 0.                                            |
| 1440×1000, host ↔ farmhand                               | Actual 36/12-slot counts followed the selected farmer; inspector retained its desktop rail and outer scroll stayed 0.                                    |
| Catalog Wood → Wood Floor; many results → exact `(O)388` | Add offset stayed 1187px; result-row width stayed 290px in the 300px list viewport.                                                                      |
| Sprite layers removed/restored                           | Equipment target rectangle stayed x300.78125/y351.59375, 48px square, with 14 image layers absent. This checks absent-art geometry, not network latency. |
| Add Wood to slot 4 → Undo                                | Add focused Slot 4: Wood; Undo restored the empty slot. Outer scroll remained 0.                                                                         |
| 1100×900                                                 | One 732px column, normal stacked overflow, no document horizontal overflow.                                                                              |
| 390×844                                                  | No horizontal overflow; slot widths at least 44px; Selected item link focused/revealed the inspector.                                                    |

The catalog reserves a four-line scrollable description and a bounded name area
so preview changes do not move Add. Both reading areas have keyboard access and
reset for a new catalog identity. Results retain their scroll position when only
the preview changes; filtering/pagination still resets the result list as before.

## Regression coverage and limits

`inventory-scroll.svelte.test.ts` covers selection-only detail resets, reading
position across real item edits, and held-touch scrolling of the nested slot pane
including saturation and cancellation without history writes. The picker suite
covers independent preview-reading resets. Existing movement, chest, focus,
lifecycle, and Undo tests remain in the full suite. All 1,125 tests, formatting,
lint/type/Svelte checks and production build passed. Independent review found and
prompted fixes for nested drag scrolling and preview reading-position reuse; its
focused follow-up found no remaining blockers.

Native Safari/iOS/Android, physical touch, browser zoom, and screen-reader use were
not qualified by these checks. First navigation still replaces a lazy-loading
status with the inventory; this pass does not preload that feature or change asset
loading policy. Sprites already reserve their projected dimensions.
