# V1 UI porting checkpoint

This checkpoint covers existing v1 editing workflows. It does not expand the
release into new pets/children, lost-progress repair, general location editing,
non-Qi special orders or the separately planned XML/parser replacement.

| V1 surface         | V2 home                                | Core coverage                                                                                                                                           |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload             | Opening screen                         | XML/compressed import, validation, original backup and export under the original filename                                                               |
| Backups            | Opening screen → Original save backups | List, open, download and explicitly delete exact stored originals; old XML and new binary/base64 entries coexist                                        |
| Inventory          | Inventory                              | Farmer selection, equipment validation, item catalog/properties, actual backpack sizes, transfers and Organize                                          |
| Chests             | Storage and Inventory                  | Content search across locations, multi-selection, transfers, bulk quality, Organize one/all, supported chest conversions and guarded mini-bin expansion |
| Character          | Character                              | Skills, professions, mastery, stats, currency and existing character unlocks                                                                            |
| Appearance         | Appearance                             | Appearance fields, colors and player preview                                                                                                            |
| Relationships      | Relationships                          | Friendship/gifts and explicit villager membership edits                                                                                                 |
| Events             | Events                                 | Known/imported event IDs, filtering/grouping and seen-state edits                                                                                       |
| Cooking / crafting | Recipes                                | Known/imported recipes, learned state and supported production counts                                                                                   |
| Quests             | Quest journal                          | Existing journal fields, completion, follow-ups and bounded reward consequences                                                                         |
| Qi quests          | Qi orders                              | Existing Qi special-order workflows                                                                                                                     |
| Farm               | Farm settings                          | Existing independent farm settings, plus the v2 calendar/weather workflow                                                                               |
| Buildings          | Buildings & animals                    | Animal fields, outside residents, adoption, building tiers and progression with paired chest movement                                                   |
| Bundles / Joja     | Community Center & Joja                | Saved/remixed requirements, donation progress, reward availability, original-room restoration, membership/projects and separate theater progression     |
| Farmhands          | Farmhands                              | Native drag and accessible slot moves, preserving farmer identities, belongings, physical homes, cabins and existing cellar identities                  |

## Preserved boundaries

Organize is a stable permutation of complete item instances. Stack merging and
splitting remain intentionally deferred. Storage discovery includes placed
chests, fridges, machine-held/named chests, building storage and building interiors.
Junimo/global shared inventories and nested bags are not writable local containers.
New source kinds cannot gain placed-chest conversion merely by carrying similar
raw flags. Existing placed owner paths remain stable.

Community Center viewing does not sanitize or rewrite the import. Only changed
room completion or an explicit project/membership action owns its progression
flags. Previously bought Joja projects survive unrelated donations. Original-room
completion does not buy the theater, and the Missing Bundle is not required to
retain non-Joja door access. Unsafe standard reward encodings cannot become
claimable, and the Missing Bundle's reward never becomes available. Unknown
bundle/reward entries remain attached rather than being globally discarded.

All-player progression excludes unnamed unclaimed cabin placeholders. Roster
reassignment keeps those placeholders at their serialized indices, transfers
whole named records, and pairs homes/cabins/cellars with physical slots. Existing
sparse cellar IDs are preserved by owner/home pairing, not reinterpreted as list
indices. Ambiguous homes, IDs or opaque cabin references remain read-only.

Archive operations read keys and values in one transaction, retain malformed
records as unavailable rows, and delete only the confirmed key. Opening an archived
original does not append another backup or evict an unrelated older original.
Expected browser/storage failures stay typed; unexpected implementation errors
remain defects at the upload-screen runtime boundary.

## Remaining release work

The core screen-port backlog is covered at this checkpoint. The independent
[porting audit](v2-porting-audit.md) records resolved core findings and deferred P3
polish/consolidation. It does not certify all devices or save variants. The visual
pass, representative Safari/device checks, broader workflow/performance release
budgets (#201), compatibility documentation and deliberate default-route cutover
still precede retiring v1. New feature milestones and the parser replacement stay
separate from this porting checkpoint.
