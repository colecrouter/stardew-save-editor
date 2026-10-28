# Inventory application migration

The `/v2` Inventory section shows the selected farmer’s equipment and backpack
together. Selecting a saved item opens its inspector; selecting an empty backpack
slot opens the catalog. Dragging moves or swaps complete items, and all edits share
the application’s review, Undo/Redo and export boundary. Stacking/merging, backpack
resizing and chest contents remain outside this slice.

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

## Item properties

The same inspector edits supported properties in backpack and equipment locations:
boots’ defense and immunity, weapon combat values, object base price and edibility,
colored-object/clothing RGB, Bottomless watering cans, and six editable trinket
families. Existing quantity and quality controls keep their established behavior.
Fields appear only when their saved representation and resolved item type support
them. Missing, malformed, custom and unsupported imported properties remain
preserved; opening the inspector does not initialize or repair them.

Numeric values commit immediately when valid. Empty numeric input stays local
while someone replaces a value; each valid input is independently undoable.
Checkboxes, native color controls and selections also write through the shared
request schema and bounded item capability. Rapid edits retain the latest visible
request while the command queue applies each change to the current item instance.
Changing equipment/backpack position does not retarget an item by its former slot.

Color edits preserve alpha and opaque members, updating an existing packed mirror
without introducing an absent one. The sprite preview reflects saved clothing dye.
Bottomless reads the game’s effective uppercase alias when present, and synchronizes
only the aliases already present after an explicit edit. Undo restores their exact
previous values, even when an imported save contained mismatched aliases.

Trinket controls show stats rolled from the saved seed with the current owner’s
income and the save’s RNG mode. A change finds a compatible seed and writes its
game-derived templates/name fields as one action, rather than saving stats that the
game would discard. Search yields between bounded batches and is interrupted when
the file scope closes. Missing/unsupported seeds and contexts stay read-only; a
no-op preserves the original seed and templates. Authoritative RNG/income reads
are checked both before preparation and before publication, so raw draft changes
cannot authorize a roll for a different game context.

Approved property patches share the inventory replay guard for complete backpack
and equipment preservation. Failed/interrupted commands publish no partial writes.
Finalization releases the baseline, patches and context reads, making escaped
capabilities inert without retaining the file’s raw data.

## Inventory identity and movement

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

Desktop mouse dragging and touch/pen pointer dragging use the same operation.
An 8-pixel movement threshold separates a drag from an ordinary selection tap;
cancellation changes no saved state. The current farmer’s labeled equipment slots
are visible above the backpack, and the inspector stays beside them on desktop or
below them on phones. Transfers operate within actual serialized backpack arrays;
neither lengths nor maxItems upgrade settings change.

Equipment has separate session identities retained alongside backpack identities.
Hat, boots, rings (including CombinedRing), shirt, pants and trinket slots accept
only compatible serialized subtypes, with shirts and pants checked distinctly.
Both exchanged records must fit their destination. Locked trinket slots reject
new equipped items; existing imported records remain preserved. Missing equipment
fields are session-only empty targets until a drop explicitly writes one, and
Undo restores the original field absence. The inventory snapshot guard includes
equipment so raw drafts cannot bypass these operations.

V2’s viewport uses the actual device width. The phone workspace reduces toolbar,
navigation and type sizes to keep equipment and backpack slots visible together;
legacy screens retain their prior viewport scale.

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
