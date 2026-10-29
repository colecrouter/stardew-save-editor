# Character details and relationships migration

This slice continues the Character migration with independent immediate fields and
adds a Relationships section using the same file-owned farmer selection. It does
not replace the XML parser or generated save types. Visual refinement is deferred
until the remaining migration work is reviewed.

## Boundaries

Domain projections interpret imported save records without normalizing them on
read. Named Effect operations validate the authoritative current target and stage
changes within the existing transaction/history boundary. Screens consume domain
fields, and shared controls own incomplete input, rejection feedback and gesture
lifetimes. Farmer selection does not create a save history entry.

Valid continuous edits update immediately and share one Undo group for the editing
gesture. Discrete changes remain individual actions. Navigation ends the active
gesture. Unknown game/mod data must survive unrelated edits and Undo/Redo.

The legacy pages remain available during migration. Feature parity and any
unsupported imported shapes are covered by the domain tests and inline reasons;
opening a screen must never silently repair or discard imported values.

## Migrated controls

Character now exposes maximum health/stamina, Qi Gems/Coins, shared hay and Golden
Walnuts, host mine depth, house upgrade scheduling/cancellation, Clint's tool
upgrade timer, trash can level, and wallet unlocks alongside skills/professions and
mastery. Imported unsupported fields remain visible and unavailable independently;
one malformed field does not disable unrelated edits.

Relationships includes existing and unknown villagers, points/hearts, weekly gifts,
search, and explicit per-villager add/remove transactions. Missing known villagers
remain visible with disabled fields until added; removal requires confirmation. Rows retain saved
order in the projection and render alphabetically so changing points never moves
a focused input. Portraits and further presentation refinement are deferred.

Independent review checked legacy coverage, typed request validation, nil-tool and
house-level guards, opaque member preservation, shared farmer selection, and stale
feedback ownership. Remaining architectural debt follows issue #194: repeated
binding/identity helpers and aggregate projection cost. This slice does not claim
to resolve those application-wide concerns.

## Backpack capacity

The capacity picker supports standard 12/24/36-slot backpacks whose saved capacity
matches their physical slot array. Growing appends canonical nil slots; shrinking
rejects occupied slots and even empty markers carrying extra opaque data. Retained
slots keep their handles; added slots receive fresh handles in the same history
publication. Undo/Redo restores both document and identity snapshots. Capacity is
a discrete action, not part of a text-edit gesture.
