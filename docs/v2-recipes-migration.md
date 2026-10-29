# Cooking and crafting migration

The Recipes section provides Cooking and Crafting categories, shared farmer
selection, literal name search, known/unknown filtering, output pictures and
item descriptions. Category changes end the active editing gesture. The panel is
mounted on first visit and retained during navigation; only the first 24 matching
rows mount initially, with an explicit action to reveal more. Search covers the
complete catalog regardless of the number of visible rows.

## Saved meaning

Recipe knowledge and production history are different concepts. Cooking knowledge
lives under the recipe name; cooked counts live under the output item identifier.
Learning or forgetting a cooking recipe never changes recorded cooking progress.
The game treats the presence of a cooked entry as completion even when its number
is zero. The screen marks that state as **Recorded as cooked**. Editing an existing
counter to zero retains that entry; explicitly resetting cooking progress removes
it after confirmation. Reset remains available for an existing zero entry.

Crafting stores knowledge and the number of items produced together. Forgetting a
crafting recipe removes that entry, so the UI confirms the loss when its count is
nonzero. Resetting its count retains knowledge. Undo restores complete affected
entries, including opaque imported members.

## Editing boundary

The domain interprets dictionaries and captures farmer, category and recipe
identity. Typed Effect operations revalidate the authoritative queued snapshot;
UI controls receive editor-owned fields and commands. Valid number input updates
immediately, with successive edits in one focus gesture sharing an Undo entry.
Incomplete input remains local. Learning, forgetting and reset are discrete
transactions, not a pending recipe form.

Imported recipes remain visible. Unknown cooking outputs have no guessed counter
identifier; malformed or duplicate target entries remain read-only. Merely viewing
a recipe does not normalize dictionaries, insert missing knowledge/counters, or
construct legacy proxies. Static aliases are shared with the legacy view.

Validation covers exact Undo/Redo preservation, independent cooking knowledge and
progress, crafting removal, duplicate/malformed containers and keys, queued typing
with farmer switching, and confirmed per-recipe actions. Visual refinement remains
part of the later v2 visual pass.

`generated/cookingrecipeoutputs.json` is the compact recipe-name to output-ID
lookup used by core projections. The asset dump regenerates it from cooking
recipe output definitions. The committed lookup was seeded from the existing
committed item catalog and shared aliases, so running the editor needs no local
game assets or eagerly loaded inventory metadata.
