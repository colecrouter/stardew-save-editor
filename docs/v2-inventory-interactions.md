# V2 inventory interaction ownership

`BackpackPanel.svelte` composes the current grids and inspector, submits model
commands and presents their expected failures. It consumes projected inventory
views; it does not decode save records or stage optimistic slot replacements.
The existing command boundary still owns validation, history and defect reporting.

## Selection and navigation

`inventory-selection.svelte.ts` owns selected instance identity, replacement
lineage, the explicit-selection version, chest filtering/navigation and guarded
focus restoration. Live getters provide current owners, the visible backpack,
chests, shared farmer selection and the DOM root. The controller requests farmer
reveal through a narrow callback rather than retaining an editor model.

Initial selection pins an instance without advancing the explicit-selection
version. Choosing a slot, chest or filter starts a new lineage and invalidates
older command callbacks. Add/remove receipts extend that lineage, allowing Undo
and Redo to find the currently present member. Transfers follow the same instance;
current owner is derived from published views, including a later queued Undo.

Command handlers capture the version before awaiting. A late result can update
selection, feedback or focus only while that version remains current. Add also
checks the invoking control before restoring focus. Focus waits for `tick`, then
reads the live root and rejects stale, hidden or unmounted targets.

## Drag and edge scrolling

`inventory-drag.svelte.ts` owns native source/hover state, touch/pen thresholds,
pointer hit-testing, compatibility-click suppression and the edge-scroll frame.
The panel supplies its `$props.id()` token, current owner/visible-grid getters,
selection callbacks and a move callback. The drag controller never submits catalog
or history operations itself. Slot eligibility is a cursor hint; the queued model
command rechecks both endpoint handles and equipment directions.

Explicit selection clears drag source/highlighting without canceling a pending
pointer gesture: its first deliberate movement still needs that captured source.
Pointer cancellation owns touch/pen cleanup; native mouse cancellation must leave
HTML dragging intact. Keyboard clicks remain accepted while a completed touch
drag suppresses its synthetic pointer click. Unmount disposes the scroll frame
and local gesture state without writing to the save.

The selection and drag ports connect lazily after both controllers exist. Their
state stays component-owned, while view/root getters keep event handlers current.
The panel retains operation errors and pending command state rather than exposing
a general writable interaction store.

## Names and verification

Shared transport, `InventoryView`, property requests and positional actions use
`ownerId`/`toOwnerId`. Farmer selection, rewards, backpack capacity and trinket RNG
context still use `farmerId`, since those operations require an actual character.
The existing `backpack-*` request discriminants and review tag strings remain
stable; their names do not restrict an owner to a farmer backpack.

`MutationRequest` accepts positional/core actions or instance-handle requests.
History resolves handle requests inside its queue into `ResolvedMutation` before
calling the operation adapter. Legacy positional actions may also carry an
optional entity handle, which history rechecks before preparation. This naming
describes the adapter boundary without introducing another raw-save schema.

`SessionState` is detached operation state, used during preparation as well as by
comparison executors. Its `OperationChange` entries are staged metadata, not
proof of commit. `PreparedInventoryTransition` pairs record writes on that draft
with staged handle state; history publishes both atomically. In contrast,
`InventoryMoveReceipt` and `InventoryReplacementReceipt` describe successful
command completion. They capture that commit's handles before a later queued
Undo can run, preserving selection lineage without rereading a later snapshot.

Existing inventory tests cover selection through reorder/Undo, replacement lineage,
equipment rules, farmer/chest transfers, native/touch cancellation and edge-scroll
teardown. Focused interaction regressions add late success/failure after a newer
choice, hidden/unmounted focus targets and keyboard activation after touch drag.
