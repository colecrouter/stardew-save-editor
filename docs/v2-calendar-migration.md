# Calendar application migration

The calendar workflow is part of the existing SvelteKit application at `/v2`.
The upload page links to it. The application owns `src/lib/editor`: the preservation
document, transactional session, calendar operations, read models, draft controls,
review, undo/redo and export. Farm settings now use that same session and command
boundary: farm name, profit margin, nighttime monsters and mine reward mode. Experiment imports are compatibility forwards to those
modules, not independent implementations. The bundle/inventory proof UI is enabled
only by the lab wrapper and is absent from the application workflow.

## Application boundaries

The default calendar session neither projects bundle state nor allocates backpack
identities. Unsupported inventory/bundle representations therefore do not prevent
calendar editing. The full document remains authoritative and unknown data survives.
Calendar rules still use the shared raw-document helpers; validation does not replace
the imported baseline with a decoded schema projection.

The legacy routes retain their existing URLs inside `(legacy)`. Only that layout
constructs `SaveManager`. Leaving it resets its independently owned item/proxy roots;
reset also invalidates pending imports and downloads. `/v2` does not restore or write
legacy development localStorage. Each editor opens its own file; there is no live
handover between writable proxy state and the Effect session.

Original files are backed up to the existing IndexedDB store only after a successful
import. Binary originals carry explicit base64 metadata, with backward-compatible
reading of older XML-text entries. Backup failure is visible but does not prevent
editing. Download validates encoded/reparsed data through the existing application
validator, blocks definite errors, preserves warnings, keeps the filename and uses
`application/octet-stream`. Both editors share DOM-attached anchor/download cleanup
and picker cancellation behavior. External file writes are not transactional history.

## Tests and supported scope

`npm run test:editor` runs the migrated session, command-boundary, rune and UI tests
plus application import/export, backup and legacy-boundary regressions. `npm test`
includes them alongside the retained codec, calendar-rule, preservation and legacy
proxy tests. No suite was parked with TODOs. The lab's `test:ui` forwards to the app
suite; remaining experiments exercise the same application-owned engine.

Scope: Stardew Valley 1.6 saves accepted by the codec/calendar adapters, including
multiplayer date mirrors and the existing ordinary/forced-weather and watering rules.
Unknown/modded data is preserved; unknown weather contexts/topology are not guessed.
This does not certify all mod formats, console saves or physical mobile devices.

Browser acceptance covers import, staged date input, navigation, conflicts, review,
undo/redo, export/reimport, original backups, legacy-state isolation, desktop/390px
layouts and the deployed `/stardew-save-editor/v2` base path. Physical-device and
broader lifetime/performance coverage remain release gates, not reasons to maintain
another runtime.

## Farm settings migration

Farm settings commit independently. A checkbox or selection updates immediately;
text and numeric input updates on blur or Enter, producing one undo step per completed
field edit. Incomplete typing stays local. Invalid input restores the committed value
and explains the validation problem. Each partial command changes only its setting;
export joins the same queue after a blur commit, so a single click includes that edit.

Farm name and profit multiplier copies update on every serialized farmer, including
unclaimed cabin records. Monster spawning and mine reward mode remain global.
Unrelated/opaque data and untouched custom or missing settings are preserved.
Profit is displayed as a percentage (100% means the stored multiplier 1); a changed
percentage must be finite and from 1 to 1000. Normal/remixed mine mode affects only
unopened reward chests, matching the legacy editor policy.

Editable controls and read-only creation explanations occupy two desktop columns,
stacking on narrower screens. Farm type, bundle creation choices, Year 1 guarantee,
wallet mode, random seed and legacy randomization remain read-only explanations.
These controls do not migrate topology, wallets or random item outcomes.

Independent settings use direct commits and undo. An explicit Apply boundary is for
changes with coordinated consequences, such as calendar date/weather/watering rules;
incomplete input alone does not justify a page-wide draft. The calendar retains its
draft, conflict handling and export gate. Farm settings have no Apply/Reload controls
or draft-specific export gate.

`tests/editor/farm.test.ts` covers coordinated multiplayer changes, preservation,
undo/redo/export, grouped failure and no-op/stale behavior. Rendered Farm tests cover
field commit boundaries, invalid input, independent history and calendar-only export
gating.

## Retiring old paths

The next work migrates features into this application session. Do not add another
runtime or interaction-specific application. New editing workflows must use the same
commit authority and move their applicable tests with them.

The legacy `/farm` remains an explicitly available compatibility path. Its settings
and calendar now have session-backed replacements and regression coverage; retiring
the legacy route is a rollout/rollback decision rather than a reason to maintain
another implementation for new work.
Remove experiment forwarding modules as their remaining comparisons are retired.
Toast styling/interaction polish remains a separate task from command error behavior.
