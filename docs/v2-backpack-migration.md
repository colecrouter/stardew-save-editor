# Backpack application migration

The existing `/v2` workspace now has an Inventory section for host and farmhand
backpacks. Select an existing item and edit supported ordinary-object quantities
or quality through the same session, review, undo/redo and export boundary as Farm
and calendar. This is the first backpack slice; creation, removal, stacking/merging,
equipment, chests and moving items in the UI remain outside its scope.

Valid quantity input commits immediately, using the existing editor range
1–9999; neither blur nor Enter is required. Clearing the number permits replacement
without writing a missing quantity into the save. Each valid input is independently
undoable. Quality uses a native radio group with normal/silver/gold/iridium choices
and commits immediately. Getter/setter bindings read the current or queued value
and route writes through the shared command boundary. The shared request schema
supplies UI feedback and command validation. Only resolved
ordinary Object records with an explicit false bigCraftable flag and existing
numeric fields are editable. Quality retains the legacy category policy. Opaque
records, tools, unsupported types and unusual imported values remain preserved;
viewing does not normalize them or initialize missing fields.

Session-only entity handles identify instances, including byte-identical records.
Selection follows its entity across reorders and undo; moving it to another farmer
invalidates the old owner handle. These cases are verified through the existing
identity-aware move/reorder commands, without exposing move controls in this slice.
No identity is serialized into XML. Tolerant production initialization allocates
handles only for unambiguous farmer IDs and array-shaped backpacks. Unsupported
inventory representations do not prevent calendar editing. This is the single
initialization policy for application and comparison consumers; no inventory mode
or feature flag changes session behavior.

A bounded BackpackItemEdits capability stages field-only writes inside a typed
Effect transaction. Before each edit, and again before publication, inventory must
match the original snapshot plus approved writes. Raw draft edits cannot fabricate
eligibility or replace/reorder entities. Failure, interruption or stale ownership
publishes none of the document, history or identity changes. Finalization clears
the capability's captured document authority so escaped services cannot keep files
alive or modify them later.

The read model detaches slot records. Metadata and sprite sheets load with the
Inventory panel; pure metadata/Sprite geometry renders them without constructing
legacy proxies. This prevents display-time writes and proxy/effect ownership from
crossing the editor boundary. Unknown drawings receive a distinct placeholder rather than resembling empty slots.
Recognized saved qualities add a star to the sprite; custom values remain untouched.
Colored-object and smoked-fish drawing rules are supported; specialized clothing
and prismatic animation remain outside this slice's visual parity claim.

Regression coverage includes exact-document export/reimport, quantity/quality undo,
byte-identical entities, cross-farmer ownership, no-ops and redo retention, illegal
raw/transient draft writes, interrupted/escaped capabilities, unsupported farmer
records, and actual application controls. The legacy inventory remains available
for broader property editing. Its applicable preservation and interaction assertions
are ported into the application tests; no suite is parked behind TODOs.
