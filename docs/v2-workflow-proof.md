# V2 workflow proof and migration decision

## Outcome

Proceed with incremental V2 migration: Effect owns the editing session and explicit
operations; Atom carries feature projections; Svelte renders shared native controls
and the accepted pixel frame. The four bounded foundation proofs now have working
evidence. This is an architecture decision and a usable lab workflow, not a V2 release.

PR #180 is merged into `v2`. `main` remains the release branch. The new workflow is
separate from the existing proxy-backed application and never shares writable save
state with it. Each imported file has one authoritative history session.

## Try the workflow

On Node 24, install the root and experiment packages, then run:

```sh
npm run lab --prefix experiments/v2
```

Open `http://127.0.0.1:5190/?flow=editor` and select a save file (the repository's
`tests/TestSave` is suitable). The default lab URL still opens the inventory comparison.
Use `npm.cmd` on PowerShell if its script policy blocks `npm.ps1`.

- Date fields are drafts. Apply commits once; navigating preserves the draft.
  Undo/redo or another edit makes a dirty draft conflict until explicitly reloaded.
  Export is disabled while the date draft is dirty.
- Weather selections commit explicit operations. Shared calendar rules retain
  forced weather, multiplayer date copies, ordinary choices and watering provenance.
- Review separates edit history from baseline net changes. Compact reorders remain
  inspectable. Repeated edits can leave history with no net changes; eviction limits
  undo without discarding the imported baseline. Actual patches include adapter
  writes even if their receipts omit them. Unlabelled writes appear prominently.
- Bundles supports **vanilla Spring Foraging only**. Confirmation stages four
  donations, its pending reward, and resulting Crafts Room/overall completion flags
  in one reversible action. It leaves inventory items in place. A claimed reward is
  not reissued. Unsupported definitions remain preserved and unavailable to this
  sample; it is not a general bundle editor.
- Export encodes through the production XML codec and validates readability. Closing
  or replacing a file closes its Effect scope, subscription and registry, and revokes
  the previous export URL. Import cancellation discards stale asynchronous results.

Bundle side effects deliberately follow the existing editor's immediate repair/mail
semantics (`src/lib/bundleSideEffects.ts`), rather than simulating the game's overnight
events. The decompiled `CommunityCenter` reward methods confirm the room mail IDs;
full in-game progression simulation remains outside this operation. Unknown record
fields, unused donation slots and unrelated mail entries are preserved.

## Evidence

Integration tests cover full-save import/export preservation, no edits on viewing,
dirty/conflicting/invalid drafts, queued export, stale revisions, failed compound
operations, history eviction, compact return-to-baseline, disposal and failed creation.
Bundle tests add export/undo/redo, last-room multiplayer flags, claimed rewards,
unknown data and rollback after donations/rewards were staged but mail validation
failed. Native Node tests also exercise the complete operation graph.

The browser proof exercises date editing across navigation, undo/redo conflicts,
bundle confirmation/cancel/Escape/focus restoration, export/reimport and fresh baseline
review. It finds no horizontal overflow at 1280, 768, 390 or 320 CSS pixels. The shared
theme now provides the box-sizing reset its frame geometry requires. The result
status receives focus after bundle completion removes the confirmation trigger.

Local validation: 575 root tests (49 files); 90 experiment tests (11 native Node and
79 Effect/Vitest); native type checks, Svelte checks, Effect diagnostics, formatting,
and the lab build. The browser scripts are deliberate stress/interaction tools,
not a new browser dependency or an automatically enforced CI timing threshold.

## Lifetime and performance measurements

Windows, Chromium 156.0.8078.47, Vite development build, full 6,652,242-byte fixture.
The fixture has already been opened and the module/font graph warmed before the
30 measured UI cycles. Each cycle imports, edits, navigates to review, undoes,
exports/downloads, closes, checks counters/URLs, and requests CDP garbage collection.
The native preview timed out twice, so Playwright CLI supplied the browser.

| UI measurement                              |   Median |    p95 |
| ------------------------------------------- | -------: | -----: |
| Import through visible calendar             | 458.5 ms | 521 ms |
| Fill year and commit through visible result | 160.5 ms | 179 ms |
| Navigate, undo and export/download          | 444.5 ms | 516 ms |

These are **end-to-end automation timings**, including Playwright and rendering,
not isolated codec/action CPU benchmarks. Copying/diffing stays on the main thread
in this lab and produces noticeable commit work; keystrokes only update the draft.
Worker integration remains available through the existing codec service boundary.

All 30 closes returned model/registry/stream counters and live export URLs to zero.
Post-GC UI heap rose from 28,279,728 to 29,172,676 bytes (about 0.85 MiB); the last
ten cycles span about 81 KB. It did not retain a whole parsed save per cycle, but
the residual growth is **not explained away as leak freedom**.

A control run repeats 30 open/edit/undo/export/close sessions without mounted UI,
collecting after each five sessions. Its six samples span 21,091,296–21,148,908 bytes
(about 56 KiB), with all counters zero. Different live fixture/UI state means the
absolute heap levels of the two runs are not comparable. Together they support
session ownership while leaving the smaller UI/dev-runtime trend to investigate.
Raw samples are in [workflow-measurements.json](../design/v2/workflow-measurements.json).

Limits: Chromium GC measurements do not cover native/GPU memory, every hidden
retainer, long sessions or physical mobile hardware. This workflow constructs no
legacy editable item proxies and starts no workers; existing worker tests establish
their own termination evidence. It does not close #169 or certify existing
`Item.fromName`, nested inventory ownership, or icon-heavy legacy views. Convenient
factories remain acceptable when their ownership outcomes are demonstrated.

## Reproduce browser measurements

Start the lab, then from the repository root:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli open 'http://127.0.0.1:5190/?flow=editor'
$script = Get-Content experiments/v2/ui-proof.mjs -Raw
$script.Replace('export default async function proof(page)', 'async function proof(page)') | Set-Content .playwright-cli/ui-proof.js -Encoding utf8
npx.cmd --yes --package @playwright/cli playwright-cli run-code --filename .playwright-cli/ui-proof.js
```

Repeat the conversion with `lifetime-proof.mjs` after the UI proof for the session-only
control. The stress scripts require Chromium CDP and the development module URLs.
Do not edit runtime sources during a run: HMR replaces the application and invalidates
the measurement. A failed run is diagnostic evidence, not a passing sample.

## What this decides, and what comes next

Adopt the session/operation/history boundary and Atom read models. Keep pure game
rules ordinary TypeScript and reuse the production codec; avoid a second writable
UI document. Native controls and the native dialog suffice for these interactions;
Bits remains available for interactions that benefit from it. A styled component
framework, universal container abstraction, persistent history, selective revert,
and a wholesale proxy rewrite remain deferred.

Next deliverable: move this supported calendar workflow into an opt-in application
entrypoint, retaining a separate legacy path. Its acceptance gate includes a supported
save/version matrix, desktop/mobile import/export guidance, failure/rollback UX and
real-device checks. Do not retire the legacy calendar until its preservation and
interaction cases pass through the replacement.

In parallel, investigate the residual UI heap trend and remaining legacy factory/view
lifetimes under #169. Inventory expansion needs catalog-backed construction, stacking
and transfer ownership before replacing the existing inventory editor. Farm topology
and calendar provenance invalidation need an explicit identity contract before farm
editing. Asset/locale loading should follow feature boundaries; the editor entry now
loads lazily and does not eagerly import the inventory comparison and game atlases.

Achievements, pets, children, location editing, mobile export and recovery stay in
their existing feature tasks. They are future consumers of this foundation, not
implicit scope for this stretch. `v2` accepts focused PRs; release criteria and feature
coverage determine when it can merge to `main`.
