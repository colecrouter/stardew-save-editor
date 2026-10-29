# Character skills migration

The v2 Character section edits the selected farmer's five normal skills,
professions, and Mastery XP through the shared command queue, review history,
Undo/Redo, and export boundary. Health, stamina, currencies, appearance, wallet
unlocks, and upgrade management remain separate migration work.

## Saved skill values

Skill XP uses the game's index order: Farming, Fishing, Foraging, Mining, Combat.
Each valid edit writes that XP entry and its corresponding saved skill-level
mirror atomically. Levels use the game's thresholds from
`Farmer.getBaseExperienceForLevel`: 0, 100, 380, 770, 1300, 2150, 3300, 4800,
6900, 10000, and 15000 XP. Extra XP entries, opaque fields, and other farmers
remain preserved. Opening the page does not repair inconsistent saved mirrors.

This is direct saved-value editing, matching the v1 editor. It does not simulate
`Farmer.gainExperience`, queue overnight level-up menus, grant recipes, replay
profession rewards, or change health and stamina. Those gameplay effects span
additional domains; silently replaying them would expand the meaning of an XP
or profession edit.

## Professions and mastery

Profession selection remains nonexclusive, as in v1. Selecting a secondary
profession includes its parent; removing a parent removes that branch's children
as one undoable change. Unrelated and imported custom profession IDs survive.
The UI explains the branch relationship without restricting the editor to the
single profession path normally chosen during gameplay.

Mastery XP edits use the game's cumulative thresholds: 0, 10000, 25000, 45000,
70000, and 100000. The minimum accounts for both recorded spent mastery levels
and the five claimed-mastery stats, so editing XP cannot put already claimed
masteries below their cost. Editing XP does not claim or revoke mastery rewards.
Existing stat-key spelling and unrelated dictionary entries are preserved.
New Mastery XP edits stop at 2147483647 because the game casts the unsigned stat
to a signed integer when computing mastery levels. Larger imported values remain
untouched; their level projection follows that signed conversion.

## Interaction and preservation

Valid inputs commit immediately; a temporarily empty numeric field remains local
while its replacement is typed. Consecutive changes to one field are grouped into one Undo gesture; discrete
profession selections remain separate actions.
Farmer identity is captured before asynchronous commands, so changing the selected
farmer cannot redirect an outstanding edit. Invalid or unsupported imported data
remains visible without display-time normalization.

Request schemas and domain validation share the value rules. Supported mutations
run against the current authoritative farmer inside the history queue, and a
failure publishes no partial edits. Undo restores original representations rather
than reconstructing a normalized farmer.

## Metadata and farmer selection follow-ups

Pure skill thresholds and profession definitions/summaries live in
`src/lib/editor/character-data.ts`; UI presentation does not import operation code
just to obtain that metadata. The short descriptions are editor-authored, not
copied from generated game text. The game loads profession text from `Strings/UI`
keys `LevelUp_ProfessionName_<name>` and `LevelUp_ProfessionDescription_<name>`.
Generating that text from unpacked assets is tracked in #194.

Legacy exposes a shared `save.player` through its sidebar farmer controls. V2
Character and Inventory currently keep separate farmer selections. A shared
session-owned selection by stable farmer identity is also a #194 planning item;
this migration does not change cross-page selection behavior. Queued commands
continue to capture their own target before asynchronous work.
