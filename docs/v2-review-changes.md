# Export review

Review compares the current save with its imported baseline. Before and After
always refer to those two states, not the previous edit or most recent download.
Repeated edits collapse to their final values. Restoring an imported value removes
it from the export summary even when history remains. Reviewing is optional;
Export does not route users through this screen.

## Domain contract

`review-contract.ts` declares a closed feature registry and discriminated change
variants. `review-presentation.ts` handles those variants exhaustively. Adding a
variant requires a presentation decision; adding a registered feature requires a
projector and icon. General domain fields use typed primitive values and existing
domain views. This does not automatically discover every new writable raw field:
projection tests and the visible fallback remain necessary.

Inventory field/value types derive from the actual item-property write contract.
Its exhaustive field mapper requires a representation for new writable properties.
Quantity and quality join that contract without weakening property/value
correlation. Imported values are described without applying new-write limits.

The history engine retains original item/equipment identities beside the import
baseline. Current handles identify moves across slots, containers and equipment,
even after Undo entries are evicted. Item names/types are not identity heuristics.
Non-exported handle changes do not become export differences.

## Conservative coverage

Domain summaries claim only explicitly accounted-for save paths. Unknown fields,
unsupported representations and coalesced parent patches stay visible under Other
save changes. A whole inventory slot is accounted for only when both its imported
and current occupants are fully explained; a pure move cannot hide an unknown
edit on the item that replaced it. Complex progression/mail and seed/template
representations can therefore appear in fallback alongside a domain summary.
Technical details retain the complete patch set, with large payloads serialized
only on explicit expansion.

History remains an action log with domain annotations, including undone edits.
It does not substitute for the net comparison and does not offer independent
row-level reversal.

## Ownership and lifecycle

`commands.review()` builds a detached immutable projection through the existing
Effect-owned queue and error boundary. It does not mutate the save, create history
or close a field gesture. The screen requests it only while active and discards
late results after a revision or navigation change. Ordinary editing publication
does not compute this additional comparison.
