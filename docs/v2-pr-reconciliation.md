# Final V2 PR reconciliation

Baseline: merged `v2` at `f637d6a0c64778fefee8a3418109797d0761cb5c`.
This pass reconciles open legacy contributions and recent main merges before #220.
The owner reviewed the feature inventory and approved including these ports in the
baseline, retaining lightweight backup guidance and explicit path copying.
#201 performance qualification is separate; its evidence remains pinned to the
source actually measured.

## Open legacy PR dispositions

All six target `main`. Their intent is carried into the v2 owners below rather
than importing a competing proxy-based workflow. Close the legacy PRs only after
this reconciliation is merged, with the replacement linked and contributor credit
preserved. Until then, these rows describe the implementation awaiting merge.

| PR                                                                                       | Before this pass                                                                                                                                                        | V2 baseline disposition                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#136 loved gifts](https://github.com/colecrouter/stardew-save-editor/pull/136)          | Weekly gift counters and name search; no loved-gift guidance.                                                                                                           | Personal/universal loves, grouped gift search, immutable item visuals and focusable named tooltips. Game taste rules, generated data and original tests retained.                                                                                 |
| [#151 backups](https://github.com/colecrouter/stardew-save-editor/pull/151)              | Transactional archive already covered persistence, binary originals, deletion and failed/malformed entries; identical fresh uploads could still evict useful originals. | Same filename/exact bytes deduplicate inside the append/prune transaction. Changed revisions survive; legacy text/base64 wrappers remain untouched. Original contributor is co-authored. Legacy BackupManager itself remains unchanged.           |
| [#152 backup reminder](https://github.com/colecrouter/stardew-save-editor/pull/152)      | Opening-screen backup/replacement advice and automatic original archive; no export modal.                                                                               | Keep owner-accepted lightweight guidance and direct export. Deliberate replacement of modal/remembered-opt-out behavior, not a claim that the dialog was implemented. Browser originals do not replace a separate save-folder backup.             |
| [#160 bundles](https://github.com/colecrouter/stardew-save-editor/pull/160)              | Donation/reward/Joja progression existed; custom requirements and whole-room controls were missing, thank-you letter was marked read.                                   | Coordinated requirement dialog, category/object selection, amounts/minimum quality, any-N count, Vault price and atomic room complete/reopen. Letter delivery uses mailbox at Bulletin Board restoration; friendship is earned when read in-game. |
| [#162 building costs](https://github.com/colecrouter/stardew-save-editor/pull/162)       | Construction metadata missing; existing descriptions were not shown in detail UI.                                                                                       | Selected building shows description and compact gold/material guidance. No costs added to the roster or charged for editor operations. Existing upgrade metadata preserved exactly.                                                               |
| [#243 picker after copying](https://github.com/colecrouter/stardew-save-editor/pull/243) | V2 had dropped inline save paths while moving guidance to SUPPORT.md.                                                                                                   | Restore #242's copy convenience with selectable paths and explicit Copy buttons. File selection remains separate, as accepted in the final discussion. No asynchronous clipboard-to-native-picker coupling.                                       |

## Recent main merges

[#241](https://github.com/colecrouter/stardew-save-editor/pull/241) added pregnancy
controls after the earlier relationship port. This was a genuine parity gap.
V2 now projects saved eligibility and dates for NPC and player marriages, with typed
queued writes and absolute due-date Review summaries. Family planning is collapsed
on the spouse row; player marriages use one equivalent compact disclosure. Expanding
reveals controls and requirements without adding an always-expanded panel. Runtime
sleeping/location/random event conditions are not inferred from a save. Directly
setting pregnancy bypasses the question; it does not create a child immediately.
No in-game birth verification is claimed.

[#242](https://github.com/colecrouter/stardew-save-editor/pull/242)'s selectable/copyable
save locations are restored in the opening screen disclosure. Clipboard denial
remains recoverable, missing support stays typed, and programming defects reach
the shared entry runtime without rejecting UI events. iOS remains a Files-app
navigation hint rather than a copyable filesystem path.

The recent merged-main inventory also includes #130–#164 (excluding still-open
PRs), covering metadata, validation, bundles, inventory/chest handling, relationship
counts, calendar, events, quests and buildings. Existing porting parity/audit
records cover those surfaces. This inventory does not claim a fresh line-by-line
correctness certification of every historical PR.

## Correctness and ownership

- Archive comparison covers canonical and noncanonical valid base64 plus legacy
  UTF-8 entries. Concurrent duplicate imports serialize with append/pruning; an
  identical upload does not rewrite timestamps, keys or opaque wrapper fields.
  Malformed rows cannot suppress a valid new backup and remain retained.
- Bundle drafts capture requirements and donations, reject stale submissions,
  preserve unknown imported IDs/metadata and reject changes that alter completion
  status. Structural edits retain row donation ownership. An omitted any-N token
  is materialized when needed to preserve its meaning after adding requirements.
- Room completion is one transaction with rewards, mail and restoration. Unknown
  rooms/unsupported rows fail atomically. Thank-you letter delivery accounts for
  already-read/pending variants, multiplayer recipients and nil mailbox wrappers.
- Pregnancy writes capture the couple and farmer identity; conflicting duplicate
  player-pair records, malformed dates and stale marriages are rejected. Nil dates
  ignore stale coordinates; enabling a date clears its nil marker and preserves
  opaque members. Untouched farmers and save data remain intact through Undo/Redo.
- Gift/cost guidance never creates Item proxies or retains writable save instances.
  Shared codegen retains contributor rule tests; only construction fields were
  merged into current building metadata. Full game assets were unavailable, so a
  complete dump regeneration was not run. Current catalog compatibility is tested.

## Attribution

- **adam110th**: original #136 gift rules/data, #151 backup behavior, #160 bundle
  editing/letter corrections and #162 cost generation. Source references:
  `359fc7f`, `9b3fb91`, `a7d470a`/`16efa2f`, and the #162 contribution branch.
- **Frank Nielson**: #241 pregnancy/eligibility and #242/#243 save-location work;
  the source includes the owner's player-child toddler correction.
- The reconciliation commit co-authors both contributors. PR descriptions and
  legacy closure comments retain links to the original contributions.

## Review discarded approaches deliberately

| Earlier approach or feature                                        | Current choice                                                                                                            | Reconciliation recommendation                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Explicit drafts/reload buttons for ordinary fields                 | Immediate valid publication; one Undo group per gesture ending on blur                                                    | Keep the agreed policy. Coordinated calendar consequences retain transactions. Do not restore drafts just to match legacy UI. |
| Separate Appearance page / faithful creation-screen recreation     | Character profile combines appearance, preview and progression (#238/#239)                                                | Keep owner-accepted combined layout. Family planning now uses a compact spouse-row disclosure.                                |
| Prominent move orchestration                                       | Drag/drop with slot validation and accessible moves where appropriate                                                     | Keep; backpack size support is real capacity, not a new nested/modded bag system.                                             |
| Stack merging/splitting                                            | Organize is a stable permutation, preserving whole instances                                                              | Remains an explicit optional feature, not an accidental parity claim.                                                         |
| Add-all missing villagers                                          | Disabled/missing state with explicit per-villager add/remove                                                              | Keep owner-accepted membership semantics.                                                                                     |
| Generic Community and Joja look together                           | Saved-route presentation, faithful Joja palette, confirmed route switch and secondary retained-donation disclosure (#232) | Keep; custom requirements now have a coordinated editor.                                                                      |
| Forced Review before export                                        | Optional typed Before/After net-change screen (#236)                                                                      | Keep direct export; do not introduce mandatory review through reminder work.                                                  |
| Raw DTO convenience in UI                                          | Intuitive immutable domain views                                                                                          | Keep. Parser/raw-type replacement remains #206 rather than a reason to restore raw access.                                    |
| Aggressive stale-reference protection / premature performance work | Retain mutative copy-on-write and freezing; optimize from measured evidence                                               | Keep agreed implementation. #201 closure includes its explicit limits and exceptions.                                         |
| Storage hidden contents / virtualization                           | Visible container contents, search, scrolling and stable selection                                                        | Keep accepted large synthetic navigation exception; reconsider only with representative interaction evidence.                 |
| Long recipe cards/collapsible flavour text                         | Compact cookbook grid with bounded flavour area (#244)                                                                    | Keep owner-accepted presentation.                                                                                             |
| Export backup modal (#152)                                         | Lightweight entry guidance                                                                                                | Owner accepted retaining the lightweight guidance, without an export modal.                                                   |
| Broad in-app compatibility/help UI                                 | Concise import/replace guidance and external SUPPORT.md                                                                   | Keep the owner's request to avoid heavy in-app guidance; Selectable paths and explicit Copy buttons are restored.             |

## Closed-without-merge PRs

The newest unmerged closures are #123, #126, #127, #128 and #129 (October 15–16).
Their author comments say they were opened against the wrong repository or should
be deleted. They are not rejected product decisions. Later merged #133 covers the
item/recipe/building description direction; do not revive obsolete generated-data
snapshots solely because the earlier PRs were closed. Older #94, #63 and other
historical alternatives are outside this recent reconciliation; current mail-flag
and compressed-save correctness must still be judged by production tests.

## Validation and remaining cutover work

Independent reviews covered entry/archive/gift/cost boundaries, pregnancy/bundle
correctness and the approved compact UI. Reported duplicate-pair, nil-date,
implicit-count and nil-mailbox defects were fixed with regression tests.

The full application suite passed 1,188 tests before the final disclosure placement;
the pregnancy workflow is rerun after that targeted UI change. Native TypeScript,
Svelte (zero errors/warnings), formatting and Effect diagnostics pass. Experiments
pass 87 tests. Production rendered checks use the established direct Playwright
approach (Browser plugin unavailable), at 1440×1000 and 390×900, with actual
clipboard copying, pregnancy controls, gift search, building costs and bundle
apply/cancel flows. Final run results are recorded with the PR.

The retained large-save navigation exceptions and performance limitations remain
explicit in #201's report. New feature code requires normal regression assessment;
old measurements do not certify different source or real hardware. #220 still
owns default-route cutover and legacy retirement. Resolving these contributions
is not itself cutover approval.

## Post-port regression probes

[Recorded samples and fingerprints](profiling/editor-reconciliation.json) retain
commit samples/maxima, accepted/observed values, trusted-delay bounds, navigation
and all six heap cycles. Full event timestamps and observer records are transient
workstation artifacts at `/tmp/reconcile-performance.json`,
`/tmp/reconcile-performance-isolated.json`,
`/tmp/reconcile-performance-isolated-standard.json` and `/tmp/reconcile-memory.json`.
This compact artifact is explicitly a summary rather than a full raw trace.

The initial five-case matrix passes every edit, queue and trusted-delay gate,
including the full-UI large/4× case. It retains failed first-Inventory gates:
523.1ms and 554.8ms versus the 500ms large-save budget. Two isolated final-build
large/4× repeats measure 124.8ms and 139.0ms and pass all their gates. Their
nonreproduction does not establish a cause or erase the misses. A small
process-lifetime cache guard for unknown villager names and archive wording
changed after the matrix; these are not claimed as performance fixes.

Closed renderer JS heap after the first large warmup rises 20.33→21.82MB across
the remaining cycles. Modest continued growth is reported; no recurring save-sized
accumulation was observed. All six exports match the complete intended document;
tracked download URLs, download anchors and probe references are zero after close.
One blob worker remains throughout, as in the earlier qualification. These are
finite renderer-JS observations, not peak/process/worker limits or leak freedom.
Existing synthetic large Storage and marginal Character navigation qualifications
remain visible in the recorded navigation samples.
