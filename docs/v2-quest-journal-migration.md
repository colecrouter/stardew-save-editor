# Quest journal migration

The v2 journal projects each farmer's saved quests newest first, with shared farmer
selection, descriptions/objectives, Help Wanted/secret/reward-pending markers,
and immediate gold/day fields. Continuous inputs share the normal focus gesture
Undo policy. Completion and removal are explicit confirmed transactions.

## Completion meaning

Completing a quest leaves any gold or other journal reward waiting for collection
in-game. Rewardless quests leave the journal. The operation does not take requested
items, grant friendship, pay gold directly into the wallet, or execute location
callbacks. Help Wanted completion updates the two relevant stats and mail flags;
every third completion attempts a Prize Ticket through the history-owned inventory
capability. The receipt says whether it was added or no safe slot was available.
A full backpack follows v1's behavior: the quest still completes, and the player
must free a slot and add the lost ticket manually. Viewing never pads inventory.

Supported story follow-ups are built from committed quest metadata. Host-only next
IDs remain host-only when a new quest is created, and Meadowlands skips the coop
quest. Already constructed building quests may finish immediately. Unsupported
follow-up types/IDs are called out before confirmation and in the result; finishing
the original quest in-game is required to start those reliably.

Secret retrieval quests remove their exclusive replacement and bypass normal
completion stats. Emily's fiber quest adds its mail flag and two-day topic; other
ID-bearing quests add the usual four-day completion topic unless already active
or previously seen. Runtime-only game callbacks are outside this direct save edit.

## Boundaries and preservation

UI receives editor-owned values, fields and captured commands, never raw save
field names. Story IDs, or immutable generated quest fingerprints for ID-less
quests, identify command targets independently of mutable reward/day values.
Indistinguishable duplicate quests remain visible with separate presentation keys
and no mutation authority. An opaque or malformed journal is read-only; unknown
members and unrelated quests remain attached to valid independently edited data.

Completion stages journal, stats, mail, dialogue and inventory changes together.
Typed failures publish no partial state. Undo/Redo restores complete affected
records and inventory identities, including opaque imported members. Merely reading
a projection does not normalize the journal or instantiate legacy proxies.

Tests cover pending rewards, recursive building follow-ups, host-only future
quests, Meadowlands, secret replacement, Emily topics, Help Wanted tickets, no-room
receipts, exact Undo/Redo, nil/duplicate guards, XML roundtrips, captured farmer
selection, grouped fields and duplicate-row UI safety. Visual refinement remains
deferred with the rest of the migration.
