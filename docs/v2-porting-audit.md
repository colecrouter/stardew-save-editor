# Independent review of the remaining UI ports

Scope: Community Center/Joja, farmer reassignment, remaining inventory/storage
workflows, archive management and their model/workspace integration. Implementers
and reviewers were separate for each feature: the roster implementer reviewed
Community/storage; the storage implementer reviewed archives; the archive
implementer reviewed roster preservation and broader composition. The parent
integrated the features, fixed reported issues and checked the rendered workflows.

## Core findings addressed

- Community rewards now accept only game-supported standard type encodings and
  signed 32-bit stack quantities before setting a claimable flag. Malformed rewards
  cannot trigger the game's null-item reward decoder. Donation definitions without
  a localized tail retain their internal name, and negative category requirements
  are distinct from Vault gold donations.
- Community and building all-player progression preserve unclaimed cabin
  placeholders. Unknown imported members and unrelated bought project flags remain
  untouched. Original-room completion and theater progression are independent.
- Roster reassignment rejects duplicate homes and opaque cabin references. Sparse
  existing cellar keys retain their physical home/owner pairing rather than being
  treated as contiguous farmer indices. Undo/Redo restores all paired metadata.
- Empty Organize is a true no-op, preserving imported empty representations and
  Redo. Structural edits reject aliased raw chest owners rather than collapsing
  separate item-handle lifetimes. Expanded discovery preserves placed owner IDs
  and denies conversions for fridge/machine/building sources.
- Bulk quality uses one authoritative checkout and one checked staging mutation,
  validating every captured handle and capability before writes. It no longer
  repeats global inventory authorization/replay for each selected item. Failure
  rolls back the entire batch, and no-op batches retain Redo.
- Storage's multiselect inspector cannot edit a visibly deselected item.
- Archive IO distinguishes expected DOMExceptions from unexpected programming
  failures. Original bytes, stored wrapper data, deletion keys and import-generation
  ownership are preserved. Downloads and stale component work have bounded owners.
- Desktop section navigation scrolls when all ported sections exceed the frame.
  The Svelte checker compatibility patch restores its resolution-iterator API and
  was verified with a deliberate type-error probe before checking the real source.

## Nonblocking P3 follow-ups

1. Share the slot-grid presentation contract between Inventory and Storage. The
   controllers and queued domain operations are already shared; duplicate button
   markup, quantity/quality rendering, ARIA and event wiring can drift over time.
   Extract a narrow renderer rather than a generic writable interaction store.
2. Consolidate Storage's focused-item/multiselect/filter ownership into a small
   feature-local selection policy. Reconcile a retained location filter when a
   building rename removes its option; keep later-choice ownership explicit for
   delayed feedback. Core batch targeting and inspector correctness are fixed.
3. Restore optional farmer-card appearance/saved-date previews during the visual
   pass. Reassignment itself preserves those underlying fields and identities.
4. Retire or clearly isolate the Spring-only proof and legacy bundle/parser paths
   at application cutover. The new production progression owner should remain the
   single place to change policy; historical proof/comparison adapters should not
   become a competing production workflow.

These are polish and maintenance follow-ups, not grounds to reopen the settled
field lifecycle, immutable domain-view boundary or parser/type-system decisions.
