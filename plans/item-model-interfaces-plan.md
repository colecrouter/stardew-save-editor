# ItemModel Interface Decomposition Plan

## 1. Field ownership per Stardew class

- The generated `Item` XML shape in [`codegen/save.ts:1274`](codegen/save.ts:1274) already centralizes most serialized members. Weapons expose combat stats such as `minDamage`, `maxDamage`, `speed`, `knockback`, `critChance`, `critMultiplier`, `addedPrecision`, `addedAreaOfEffect`, and `addedDefense` (`codegen/save.ts:1297-1334`).
- Boots serialize `addedDefense`/`immunityBonus`/`indexInColorSheet` (`codegen/save.ts:1337-1345`).
- Hats rely on `which`, `skipHairDraw`, `ignoreHairstyleOffset`, and `hairDrawType` (`codegen/save.ts:1371-1386` plus migrations in [`StardewValleyDecompiled/Stardew Valley/StardewValley.Objects/Hat.cs:49-51`](StardewValleyDecompiled/Stardew Valley/StardewValley.Objects/Hat.cs:49-51)).
- Rings (Objects with `TypeEnum.Ring`) include `uniqueID` (`codegen/save.ts:1346-1352`).
- Colored objects reuse the shared `color` value along with `type === Object` and `@_xsi:type === ColoredObject` (`codegen/save.ts:1358-1364`).
- Trinkets carry `generationSeed` when `_type === Trinket` (`codegen/save.ts:1400-1402`).
- Tools serialize `upgradeLevel`, `numAttachmentSlots`, and `attachments` (`codegen/save.ts:1292-1297` combined with `codegen/helpers.ts:84-95` showing how JSON imports map those fields).
- Clothing pieces (`Shirt`/`Pants`) persist `clothesType`, `clothesColor`, `dyeable`, and `canBeDyed` (`codegen/save.ts:1342-1349`).

## 2. Proposed TypeScript interface hierarchy

1. `ItemModelBase` extends `Item` but narrows to the fields every proxy currently reads/writes (name, itemId, category, quality, stack, price, color, type, parent stats, etc.). This mirrors the shared logic in [`src/lib/proxies/items/ItemProxy.ts:73-158`](src/lib/proxies/items/ItemProxy.ts:73-158).
2. `WeaponItemModel extends ItemModelBase` adds the combat stats (`minDamage`, `maxDamage`, `speed`, `knockback`, `critChance`, `critMultiplier`, `addedPrecision`, `addedAreaOfEffect`, `addedDefense`, `immunityBonus` optional) plus the `_type === Weapon` guard referenced by `WeaponProxy` (`src/lib/proxies/items/WeaponProxy.ts:5-32`).
3. `BootsItemModel` tightens `addedDefense`, `immunityBonus`, `indexInColorSheet`, and `color` (used by `BootsProxy` helpers at [`src/lib/proxies/items/BootsProxy.ts:24-35`](src/lib/proxies/items/BootsProxy.ts:24-35)).
4. `HatItemModel` requires `which`, `skipHairDraw`, `ignoreHairstyleOffset`, and `hairDrawType`, corresponding directly to the getters/setters in `HatProxy` (`src/lib/proxies/items/HatProxy.ts:24-46`).
5. `RingItemModel` includes `uniqueID` along with `type === TypeEnum.Ring` and `@_xsi:type === Ring`, matching `RingProxy` (`src/lib/proxies/items/RingProxy.ts:8-30`).
6. `ColoredObjectItemModel` tightens the `color` member that `ColoredObjectProxy` manipulates (`src/lib/proxies/items/ColoredObjectProxy.ts:11-19`).
7. `TrinketItemModel` exposes `generationSeed` for both getter and setter work in `TrinketProxy` (`src/lib/proxies/items/TrinketProxy.ts:13-23`).
8. `ToolItemModel` includes `upgradeLevel`, `numAttachmentSlots`, `attachments`, and any serialized `@_xsi:type` (tools yet to use these fields but plan for future). The helper generation in `codegen/helpers.ts:84-95` shows how these values enter the data pipeline.
9. `ClothingItemModel` keeps `clothesType`, `clothesColor`, and dyeable flags (`src/lib/proxies/items/ClothingProxy.ts:22-41`).

Each specialized interface should add a literal `_type` (or `type`/`@_xsi:type`) constraint so consumers can safely narrow the raw XML record to the right shape.

## 3. Proxy/factory refactor plan

1. Update each proxy constructor signature to accept the corresponding narrowed interface (e.g., `constructor(raw: WeaponItemModel)`). That eliminates the current `_type` guard checks at runtime and keeps the derived `info` lookups (`ItemProxy` base) intact.
2. `createItemProxy` will perform early narrowing using `resolveItemInformation(raw)` plus the `@_xsi:type` inspection already implemented in [`src/lib/proxies/items/index.ts:12-35`](src/lib/proxies/items/index.ts:12-35). After determining the specific `_type`, it can safely cast the `raw` parameter to the matching interface before instantiating the proxy.
3. Shared helpers that mutate fields (e.g., `ItemProxy` syncing price, quality, stack) continue referencing `ItemModelBase`. Specialized proxies only gain typed access to their extra fields, reducing runtime casting.

## 4. Codegen vs. manual interfaces

- The generated `Item` shape in `codegen/save.ts` already includes all optional fields. However, it lacks per-class discriminated unions. We can either:
  - Extend the codegen step to emit per-`_type` interfaces (e.g., `WeaponItem`, `HatItem`) based on `_type` metadata and `@_xsi:type`. That would keep XML contract definitions close to the source data.
  - Define manual helper interfaces in `src/lib/proxies/items/types.ts` (or similar) that reuse `ItemModelBase`. These helpers would remain in sync by referencing the same field list we cataloged above.
- Whichever path is chosen, ensure every special interface extends `ItemModelBase` so that general logic in `ItemProxy` stays type-safe.

## 5. Documentation handoff

Capture this blueprint (provided in `/plans/item-model-interfaces-plan.md`) so that the next implementation pass can:
1. Confirm the exact field sets by auditing `codegen/save.ts` and the relevant proxies.
2. Decide whether to enhance the code generator or keep manual helper interfaces.
3. Refactor `createItemProxy` and each proxy constructor to accept the narrowed raw shape.
4. Verify there are no remaining runtime typecasts when accessing per-class fields.
