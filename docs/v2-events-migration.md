# Events migration

The Events section retains v1's event catalog, search by name/ID/description,
character and location grouping, seen/unseen filtering, character portraits and
custom event ID controls. It shares farmer selection with the other v2 sections.
The panel mounts on first visit and stays mounted during navigation. A single
24-row budget bounds controls across all groups and imported IDs; Show more
reveals additional matches, while search considers the entire catalog.

## Saved meaning and editing

An event's seen flag records that its cutscene has played. Removing it permits
the game to replay the event when its location and conditions match, including
any rewards it grants. Adding it skips the event without granting those rewards.
The editor changes the flag only: it does not execute, reverse or simulate a
cutscene's game effects.

Known events use shared discrete checkbox fields. Multi-character events can
appear under several groups; every occurrence addresses the same farmer/event
identity and reflects the same authoritative flag. Custom ID additions and
removals are explicit atomic transactions. Each action is independently Undoable.
Queued actions capture the original farmer rather than following later selection.

A shared pure ID parser provides form hints and is rechecked at the Effect domain
boundary. Canonicalization applies only to a deliberate new input, never to the
imported list during viewing. Unsupported imported entries, duplicate identities,
and opaque list members remain preserved; unavailable flags show their reason.
The UI displays a notice when some imported entries cannot be represented as IDs.

## Scope and validation

The wiki catalog remains display metadata and retains its attribution. Core event
projections do not import that catalog or legacy reactive proxies. UI consumes
domain fields and captured commands without knowing XML container details.
Expected rejections are typed Effects; defects and cancellation remain at the
shared file command boundary. Late custom-action feedback is scoped to its farmer
and file, so it cannot appear beside another target after selection changes.

UI integration tests exercise queued independent toggles followed by a farmer
switch, shared selection across sections, custom ID validation/add/remove with
Undo, bounded mounting, multi-character flag synchronization and location/filter
changes. Broader visual refinement remains part of the later v2 visual pass.
