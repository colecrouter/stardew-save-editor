# Buildings and animals in v2

The application-owned Buildings & animals section projects buildings, listed
residents and animals without a discovered home. Listed residents include animals
outside and missing records; capacity never depends only on the number inside.
Selection uses serialized building IDs. Duplicate IDs collapse into an explicit
read-only row so malformed imports cannot create duplicate Svelte keys.

`building-data.ts` contains the bounded saved-data lens and presentation views.
It recognizes empty, singleton and array dictionaries without writing defaults.
Animal dictionary keys must agree with `myID`, and separately parsed lowercase
and uppercase dictionary mirrors must agree before editing. Unknown members remain
attached. An unsupported name disables only Name, leaving independently supported
numeric fields available. These checks are not a replacement XML type system.

## Ordinary fields and consequences

Name, days owned, gender, friendship, happiness, fullness, pregnancy and Golden
Animal Cracker controls use shared immediate fields. Valid writes publish
immediately; text/number focus gestures produce one net Undo entry on blur.
Name updates its display-name mirror, and days owned updates age. Negative saved
days-owned counters display age without normalizing the imported record. Omitted
booleans expose the game's defaults without writing until deliberately edited.

Tier selection and adoption use explicit consequence drafts. Selecting a tier
alone changes no saved data; Apply tier commits the completed-building changes.
Adoption validates the current building, animal type, resident capacity, name and
selected farmer before publishing anything. It creates both animal dictionary
serializations, a resident ID, inside occupancy, the global ID sequence and the
purchase conversation topic together. Topics are not restarted when already
active or previously seen. Adoption is free, matching v1.

## Shared game rules and inventory ownership

Catalog-only family/occupant rules live in `animalBuildingData.ts`; they do not
load the item factory during initial model projection. `farmAnimalData.ts` creates
saved animal records without Svelte effects. Legacy proxies and v2 use the same
factory and `changeBuildingTier` engine in `animalBuildings.ts`.

Upgrades walk intermediate tiers, move interior objects/furniture, place generated
items and publish construction/mail/dialogue consequences. Downgrades reverse
the same steps, retaining in-use or obstructed contents and returning warnings.
Resident capacity blocks a downgrade; higher-tier species alone do not, matching
v1. Unsupported interior collection shapes reject rather than being replaced.
The Greenhouse control edits the farm's unlock flag, with no unrelated progression.

Building transitions can move placed chests or change their owner paths when an
object list compacts. `InventoryEdits.upgradeBuilding` therefore owns this checked
structural operation alongside other inventory writes. It carries each existing
chest's item handles through the private raw object's identity, then publishes
those handles with the document. Ordered authorization replay includes item
writes, capacity changes and building transitions in their original order. It
never authorizes arbitrary caller-supplied raw inventory patches. Ordinary animal
edits and adoption remain domain programs using the detached draft capability.

Undo/Redo restores progression, interiors, animals and item handles together.
The DTO lens and catalog compatibility casts remain inside the adapters; components
receive domain values and narrow field/action capabilities.

## Verification

Migration regressions cover non-mutating projection, outside residents, mirrored
field edits, age/name pairing, full/incompatible adoption, duplicate names and
identities, unsupported fields, construction, capacity, intermediate tiers,
progression, XML export/reimport and rollback. Chest cases exercise a Coop move
and a downgrade removing an earlier incubator, checking changed tiles/owner paths
and exact handle lineage through Undo/Redo. The workspace test covers grouped
input, outside animal editing, tier drafts, adoption and retained navigation.

This migrates the existing building/animal editor. Moving buildings, reassigning
animal homes, animal removal, and general location editing are separate features.
