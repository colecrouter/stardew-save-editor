# Backpack application migration

The existing `/v2` workspace now has an Inventory section for host and farmhand
backpacks. Select an existing item and edit supported ordinary-object quantities
or quality through the same session, review, undo/redo and export boundary as Farm
and calendar. The first slice covered quantity and quality; the workspace now also adds catalog
items to empty slots and removes existing records. Stacking/merging, equipment,
and chest contents remain outside its scope. Backpack organization now supports
moving and swapping existing items within or between farmers’ backpacks.

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
Selection follows its entity across reorders, transfers and Undo/Redo. A transfer
invalidates the old owner handle; the UI follows the same item to its current owner
rather than selecting whatever replaced its old slot.
Add/remove starts from an exact session handle, including the empty destination.
The command queue validates that handle and the current slot state before writing;
occupied targets and stale clicks reject instead of replacing another item. Every
replacement receives a fresh handle. The model returns that exact committed pair
before releasing the queue, so a subsequent Undo cannot race a UI snapshot lookup.
Selection remembers only its own replacement lineage across Undo/Redo; an explicit
slot or owner selection starts a new lineage. No identity is serialized into XML. Tolerant production initialization allocates
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

Movement names both endpoint identities, including an empty slot’s handle. The
history lock resolves both against the current owners before applying one atomic
exchange of full records and handles. An empty destination returns its exact nil
representation to the source; an occupied destination swaps complete items without
merging or normalizing either one. Byte-identical items remain distinct instances.
Self-drops are no-ops and preserve redo. Stale endpoints, empty sources, ambiguous
owners and unsupported inventories fail without publishing any partial movement.

Desktop users can drag onto another slot in the displayed backpack. The Move item
action pins the source, exposes a destination backpack selector and labels each
available destination as Move or Swap; it also serves touch and keyboard users.
Escape/Cancel returns to the source without changing the save. Transfers operate
within actual serialized slot arrays, including farmers with different backpack
sizes; neither their lengths nor maxItems upgrade settings change.

The in-place catalog spans the desktop workspace beneath the backpack. Name,
qualified ID and bare ID searches share one matching/ranking helper; type filters
and 48-result pages make the full supported catalog reachable. Choosing a result
previews its sprite, description and ID without writing to the save. The explicit
Add action places one item in the selected empty slot. Removal is a separate
immediately undoable inspector action, including for opaque imported items.
Neither action merges with another stack or changes unrelated slots.

Catalog construction uses generated metadata and plain records, with no legacy
proxy/effect root. Only new items receive these defaults; imported records never
pass through the factory. Preview records are not write authority: the command
reconstructs the chosen ID from trusted metadata. Type-specific construction and
conservative exclusions are covered by domain tests. Specialized subclasses such
as chests, garden pots, beds/storage/fish-tank furniture and slingshots, furniture
without explicit geometry, and player trash-can upgrades are not addable yet.
Existing saved records of those kinds can still be removed and restored exactly
with Undo; the exclusion is solely about constructing new instances.

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
records, and actual application controls. Catalog coverage also verifies stale empty
handles, occupied-slot rejection, new-item defaults, preview isolation, filtering
and pagination, complete opaque-item removal/Undo, and add/remove selection through
Undo/Redo. Movement coverage includes cross-owner selection, both stale endpoint
handles, variable capacities, opaque/nil records and byte-identical swaps. The legacy inventory remains available
for broader property editing. Its applicable preservation and interaction assertions
are ported into the application tests; no suite is parked behind TODOs.
