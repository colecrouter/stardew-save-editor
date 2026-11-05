# Final foundation checkpoint

This checkpoint reconciles accepted visual work with #218 and exercises the
remaining concrete #219 contracts. It is not cutover approval, accessibility
certification, or a request to repeat every earlier lifecycle experiment.

Candidate: `v2-foundation-validation`, based on merged v2 `4bb5d9a`.
The production-browser checks include the export failure fix in this branch.

## Page dispositions

All current editor sections were revisited at 1440×1000, 768×900, 390×900 and
320×900 in macOS Chromium: 56 section/viewport cases. Each rendered meaningful
headings, with no document horizontal overflow or unnamed rendered native
input/select/textarea/button found by the label/ARIA/text/title check. This is a
DOM/rendering check, not a screen-reader session. The current editor has 14 sections;
appearance is part of Character. Historical reports of 15 sections predate that merge.

| Surface                          | Accepted design evidence / current disposition                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inventory/equipment/catalog      | #229/#251; current desktop/narrow sweep retained. Detailed geometry evidence remains in `v2-inventory-layout-validation.md`.                                                         |
| Buildings/animals                | #237; type-preview renderer contract retained.                                                                                                                                       |
| Community Center/Joja            | #232; current saved-route and retained-donation checks passed.                                                                                                                       |
| Farmhands                        | #240; compact roster, appearance previews and drag/keyboard movement accepted.                                                                                                       |
| Storage                          | #245; independent desktop panes and phone detail flow accepted.                                                                                                                      |
| Character/appearance/progression | #238/#239 and direct `d6d9d28` skill-indicator styling accepted.                                                                                                                     |
| Relationships                    | #240; portraits/hearts and explicit record membership accepted.                                                                                                                      |
| Quest journal                    | #234; bulletin-board treatment accepted.                                                                                                                                             |
| Qi orders                        | #234/#248; local palette and scroll controls accepted.                                                                                                                               |
| Events                           | Current grouped portrait/list presentation reviewed at desktop/phone; populated and empty-search states passed. No concrete redesign need found; owner visual signoff still pending. |
| Recipes                          | #244; dense catalog and fixed flavour text accepted.                                                                                                                                 |
| Farm settings                    | #246; shared panels and saved references accepted.                                                                                                                                   |
| Calendar/weather                 | #233/#235; calendar motifs and coordinated date semantics accepted.                                                                                                                  |
| Review changes                   | #236; typed human-readable net changes accepted.                                                                                                                                     |
| Entrypoint/original backups      | #249; file guidance, original-byte archive and document wallpaper accepted.                                                                                                          |

The exact blanket per-field immediate-update/Undo wording is absent from the editor.
Remaining guidance describes specific consequences or the accepted global entry flow.
Across Inventory, Character, Recipes, Events, Farm settings and Review, every sidebar
row stayed 48px tall and the first row's position stayed unchanged as selection moved.
No broad app-wide zero-layout-shift claim is made.

## Keyboard, focus and saved-route checks

Native Chromium text editing was seeded with the browser's `insertText` editing
command, then trusted keyboard events were sent through the preview browser:

- Farm name `Meadow` → `Native Undo Farm`; Command+Z restored `Meadow` and
  Shift+Command+Z restored `Native Undo Farm` while the input retained focus.
  The workspace left both editing events unconsumed.
- After blur, Command+Z from the history button restored the saved farm name;
  the workspace consumed the available save-history command.
- With the Community route dialog open and Cancel focused, Command+Z did not
  change the saved farm name. Four forward and four reverse Tab presses stayed
  in the modal. Escape closed it; a real trigger click allowed focus to return to
  Change route. Save-history Undo worked again after closure settled.
- Both platform mappings, unavailable commands, IME/repeat guards, native-editable
  ownership and listener teardown are also covered by #250's tests. Native Windows
  and Safari behavior were not separately qualified.

The accepted Joja policy is **one active restoration route**, with retained Center
records behind a collapsed secondary disclosure. It does not prohibit inspecting
or editing those retained donations. In the production browser, choosing Joja in
the draft did not expose the Joja plan; committing exposed it with retained donations
collapsed. The real-workspace route suite also rechecked cancel, donations/rewards,
money/items and Undo/Redo preservation. No route redesign is proposed.

## Export failure finding and fix

The old shared download helper left acquired streams without an explicit abort
after write/close rejection. Its broad AbortError catch also classified stream
failures as user picker cancellation. Three new tests failed on the old helper.

Only picker cancellation now returns false as normal noncompletion. Writable
acquisition/use/release has a typed Effect resource scope. Failed write/close
attempts abort the owned stream and report their original failure; a secondary
abort rejection does not hide that primary failure. If a late, unused acquisition
must abort and cleanup itself rejects, that cleanup failure is reported because
there is no earlier write error to preserve. Successful close does not abort.
The existing Promise interface, original filename and delayed Safari fallback
anchor/URL cleanup remain intact.

Tests reject the actual write and close phases, including AbortError, then edit
and successfully retry in the same real application session. Retry exports the
latest farm name under the original filename; independent backup feedback survives.
Existing late-picker/stream teardown tests still pass. These controlled stream
doubles verify the application failure contract and cleanup attempt, not native
filesystem cleanup under actual disk/permission failure.

All 1,131 application tests and 87 experiment tests pass, along with native types,
Svelte/lint checks, production build, and Effect diagnostics (zero warnings/errors).
Independent review caught and prompted coverage for cleanup-only rejection after a
late acquisition. Formatting is checked separately before publication.

## Genuine remaining native checks

Keep these explicit in #219 rather than inferring success from DOM automation:

1. **Screen reader:** record browser/OS/assistive-technology versions. Read upload
   and invalid-file feedback, section selection, one text/number edit, item selection,
   and a confirmation dialog. Check names/state, reachable controls and announcements.
   No actual VoiceOver or other screen-reader run was performed here.
2. **Native select menu:** two preview keyboard attempts (open menu + ArrowUp/Enter,
   then focused closed control + ArrowUp/Enter) left the selected section unchanged.
   Trusted text keyboard events work, but that does not establish native menu control.
   This is an automation limit, not a demonstrated application failure. Check the
   Section menu with real keyboard arrows and Enter/Escape in a native browser.
3. **macOS rubber-band:** use a trackpad to overscroll the upload screen and editor
   at their document edges. Verify the landscape/document canvas stays painted.
   The implementation is on html, but actual compositor overscroll was not exercised.

Events visual signoff is the remaining page-specific owner decision. #218/#219
remain open for these explicit items and final acceptance; #220 still owns the
route change and its production smoke tests. #201's agreed performance criteria
remain separate. Do not add speculative optimization or indefinite soak testing
without a concrete finding.
