# Domain views and immediate field editing

This is the current direction for V2 domain/field adapters. It supersedes the
original stack-draft experiment as the default for independent field edits.
The XML parser and raw save type system are deliberately outside this refactor;
only the existing adapters needed by these domains are used.

## Ownership

Component-facing values follow the [immutable domain projection contract](v2-domain-projections.md).
Views should be intuitive for UI use, rather than mirror the underlying save DTO.

UI consumes editor-owned domain views and field adapters, not SDV field names,
XML arrays, stats dictionaries, or generated save-type casts. Character, Farm and the migrated inventory inspectors use this boundary. Named domain operations own validation and coordinated
saved-value updates; they expose typed Effect failures. Deterministic arithmetic
on checked values remains plain code. Pure metadata lives separately from the
operation implementation.

A shared field editing controller handles local incomplete input, optimistic
pending values, latest-request ownership and expected rejection feedback.
Presentation controls consume the field contract without constructing domain
transactions or receiving the whole editor model. A domain adapter binds the
field to a captured target and a named operation through the file-owned command
boundary. Unexpected defects and cancellation stay at that boundary.

The same policy applies to independent text, number and discrete inputs. Valid
values are applied atomically as they are entered. Blank replacement text stays
local when it does not represent a domain value. Rejection leaves the last
committed value intact; it is not a successful save action.

## Undo gestures

Applying a value and finalizing an Undo step are separate operations. A field
focus/typing gesture may publish several valid values, but one Undo step retains
the original state and the latest result. Grouping includes any coordinated domain
writes, such as XP and its saved level mirror, rather than concatenating UI-level
field assignments.

Blur ends the Undo group; it does not first apply the value. A different field,
another command, Undo/Redo, export, a target/section change, or file close ends the
gesture. Discrete checkbox/select actions are separate Undo steps. No transaction,
lock or uncommitted document is held open while an input has focus.

Field descriptors are snapshots of presentation values plus captured commands,
not live proxies. A stable opaque scope symbol identifies the file session; the
key identifies the target and command meaning within that scope. Rebuilding a
descriptor from a new projection does not start another gesture.

The group identity combines the domain field/target with an opaque edit gesture.
Inputs do not construct grouping IDs, patches or transaction metadata. Queued
updates capture their original field target; later selection changes cannot
redirect them. Ending a gesture is ordered behind its submitted writes.

History recomputes a group's before/after changes, rather than blindly appending
patches. Returning the actual document and domain state to their original values
leaves no net Undo entry and retains the prior redo branch. Matching the original
input text alone is insufficient if a deliberate domain write changed a saved
mirror as well. Failed field edits do not partially publish changes. Standalone
commands close the current editing group even if that later command is rejected.
History limits and eviction still apply to the resulting grouped entry.

## Farmer selection

The selected farmer belongs to the file session and is shared by Inventory and
Character. Selection uses stable farmer identity rather than a page-local array
index. Changing it ends the current edit; pending commands retain their captured
old target. Chest browsing and item selection remain Inventory-local concerns.
Selection itself is UI session state, not an XML mutation or an Undo entry.

## Scope and verification

The shared field policy now covers Character, Character details, Farm,
Inventory inspectors, Appearance, Relationships, Recipes, Events, Quests and Qi
orders. `field-binding.ts` binds narrow editing capabilities to captured domain
operations; presentation controls receive no complete editor model. Farmer
selection has a separate identity projection and narrow selection capability.
Calendar retains its explicit coordinated draft. Inventory record/identity
transitions now have a paired owner in `inventory-transition.ts`.

Parser/raw types remain outside this work. Whole-save projection costs and
inventory controller/metadata consolidation continue in [#201](https://github.com/colecrouter/stardew-save-editor/issues/201)
and [#202](https://github.com/colecrouter/stardew-save-editor/issues/202).
See [current status](v2-status.md) for coverage and the latest audit.

Verification must cover grouped text and numeric edits, cross-field/action
boundaries, valid export before blur, invalid and incomplete values, returning to
the original state, redo preservation, queued edits, target changes, close cleanup,
exact-document Undo/Redo, and history-limit behavior. A follow-up independent
quality audit assesses whether the new boundaries remove duplication instead of
hiding it behind new names.

The [original follow-up audit](v2-domain-fields-audit.md) records the first field
refactor. The [cleanup audit](v2-cleanup-audit.md) assesses the current boundaries,
remaining concerns and measured clone/projection costs.
