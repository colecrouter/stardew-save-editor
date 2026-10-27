# Calendar application migration

The calendar workflow is part of the existing SvelteKit application at `/v2`.
The upload page links to it. The application owns `src/lib/editor`: the preservation
document, transactional session, calendar operations, read models, draft controls,
review, undo/redo and export. Experiment imports are compatibility forwards to those
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

## Retiring old paths

The next work migrates features into this application session. Do not add another
runtime or interaction-specific application. New editing workflows must use the same
commit authority and move their applicable tests with them.

Keep the legacy calendar while the rest of `/farm` settings still depend on proxy
state. Retire it when those supported farm workflows have an explicit session-backed
replacement, preservation/interaction coverage and a release/rollback decision.
Remove experiment forwarding modules as their remaining comparisons are retired.
Toast styling/interaction polish remains a separate task from command error behavior.
