<script lang="ts">
  import {
    CategoriesWithQuality,
    FishingRodSpriteIndex,
    FishingRodUpgradeNumber,
    FurnitureTypeToNumber,
    RingsUniqueID,
  } from "$lib/ItemData";
  import type { ParentIndex } from "$lib/ItemParentIndex";
  import { CalculateEdibility, CalculatePrice } from "$lib/ItemQuality";
  import { Character } from "$lib/SaveFile";
  import { HexToRGB, RGBToHex } from "$lib/Spritesheet";
  import { FurnitureType, type ItemInformation } from "$types/items/1.6";
  import { Category } from "$types/save/1.5";
  import type { Item, Player, TypeEnum } from "$types/save/1.6";
  import { getContext } from "svelte";
  import Container from "../../Container.svelte";
  import Preview from "../appearance/Preview.svelte";
  import BigItem from "./BigItem.svelte";
  import QualitySelector from "./QualitySelector.svelte";
  import SmallItem from "./SmallItem.svelte";

  const itemData = getContext<Map<string, ItemInformation>>("itemData");
  let selectedItemData: ItemInformation | undefined;

  let inventory: Array<Item | undefined> = [];
  let selectedItem: Item | undefined;
  let selectedIndex: ParentIndex;

  // Update our reference to the select player
  let player: Player | undefined;
  Character.character.subscribe((c) => {
    if (!c) return;

    player = c;
    inventory = c.items.Item;
  });

  // Price/edibility calculation
  let oldQuality: number | undefined;

  $: (() => {
    // Refresh the selected item hardcoded data
    selectedItemData = selectedItem
      ? itemData.get(selectedItem?.name)
      : undefined;

    selectedItem &&
      console.debug("Selected item:", selectedItem?.name, selectedIndex);

    // Calculate price/edibility for default price/edibility items
    if (selectedItem?.quality === undefined) return;

    try {
      // When the item is first clicked, oldQuality will be undefined
      if (oldQuality === undefined) oldQuality = selectedItem.quality;

      // If the quality hasn't changed, we don't need to do anything
      if (oldQuality === selectedItem.quality) return;

      if (!selectedItemData) return;

      // Check if the items price is the same as the default price
      // If so, we need to change the price whenever the quality changes
      // If not, we can assume the user has changed it, so just leave it alone
      if ("Price" in selectedItemData && selectedItem.price) {
        const theoreticalOldPrice = CalculatePrice(
          selectedItemData.Price,
          oldQuality ?? 0
        );
        if (theoreticalOldPrice === selectedItem.price) {
          selectedItem.price = CalculatePrice(
            selectedItemData.Price,
            selectedItem.quality
          );
        }
      }

      if ("Edibility" in selectedItemData && selectedItem.edibility) {
        const theoreticalOldEdibility = CalculateEdibility(
          selectedItemData.Edibility,
          oldQuality ?? 0
        );
        if (theoreticalOldEdibility === selectedItem.edibility) {
          selectedItem.edibility = CalculateEdibility(
            selectedItemData.Edibility,
            selectedItem.quality
          );
        }
      }
    } finally {
      // Store the previous quality value at the end
      oldQuality = selectedItem.quality;
    }
  })();

  let newItemName: string;

  const deleteItem = (symbol: ParentIndex) => {
    if (!player) return;

    if (typeof symbol === "number") {
      inventory[symbol] = undefined;
    } else {
      player[symbol] = undefined;
    }

    // Clear item from the editor window
    selectedItem = undefined;
    oldQuality = undefined;
  };

  const createItem = (symbol: ParentIndex) => {
    if (!player) return;

    const newItemData = itemData.get(newItemName);
    if (!newItemData) {
      alert(`Item "${newItemName}" not found!`);
      return;
    }

    let category: number | undefined;
    switch (newItemData._type) {
      case "Object":
        break;
      case "BigCraftable":
        break;
      case "Boots":
        category = Category.Boots;
        break;
      case "Pants":
      case "Shirt":
        category = Category.Clothing;
        break;
      case "Furniture":
        category = Category.Furniture;
        break;
      case "Hat":
        category = Category.Hat;
        break;
      case "Weapon":
        category = Category.Weapon;
        break;
      case "Tool":
        category = Category.Tool;
        break;
    }

    const newItem: Item = {
      name: newItemName,
      itemId:
        "ParentSheetIndex" in newItemData
          ? newItemData.ParentSheetIndex
          : "SpriteIndex" in newItemData
            ? newItemData.SpriteIndex
            : 0,
      stack: 1,
      quality: 0,
      isRecipe: false,
      parentSheetIndex:
        "ParentSheetIndex" in newItemData ? newItemData.ParentSheetIndex : 0,
      indexInTileSheet:
        "SpriteIndex" in newItemData ? newItemData.SpriteIndex : 0,
      category: category,
      hasBeenInInventory: true,
      SpecialVariable: 0, // TODO ?
      isLostItem: false,
      specialItem: false,
      tileLocation: { X: 0, Y: 0 },
      boundingBox: {
        X: 0,
        Y: 0,
        Width: 64,
        Height: 64,
        Size: { X: 64, Y: 64 },
        Location: { X: 0, Y: 0 },
      },
      canBeSetDown: true,
      canBeGrabbed: true,
    };

    let type: string | undefined;
    switch (newItemData._type) {
      case "Object":
      case "BigCraftable":
        type = "Object";
        break;
      case "Furniture":
        type = "Furniture";
        break;
      case "Weapon":
        type = "MeleeWeapon";
        break;
      case "Tool":
        if (newItemName === "Milk Pail") {
          type = "MilkPail";
        } else if (newItemName.endsWith("Pickaxe")) {
          type = "Pickaxe";
        } else if (newItemName.endsWith("Axe")) {
          type = "Axe";
        } else if (newItemName.endsWith("Hoe")) {
          type = "Hoe";
        } else if (newItemName.endsWith("Watering Can")) {
          type = "WateringCan";
        } else if (newItemName.endsWith("Rod")) {
          type = "FishingRod";
          // All fishing rods are called "Fishing Rod" in the game data
          // This actually still works if you don't have the right name, but might as well fix it
          newItemName = "Fishing Rod";
        } else if (newItemName.endsWith("Pan")) {
          type = "Pan";
        }
        // TODO
        break;
    }

    if (type) {
      // This is required for the game to recognize the item as the correct type, but isn't part of the XML structures
      // @ts-expect-error
      newItem["@_xsi:type"] = type;

      if (symbol === "hat" && newItemName === "Copper Pan") {
        // @ts-expect-error
        newItem["@_xsi:type"] = "Hat";
      }
    }

    if (newItemData._type === "Object") {
      newItem.price = 0;
      newItem.quality = 0;

      if (newItemData.Type === "Ring") {
        const id = RingsUniqueID.get(newItemName);
        if (id) {
          newItem.uniqueID = id;
        }
      }
    }

    if (newItemData._type !== "Tool") {
      newItem.parentSheetIndex =
        "SpriteIndex" in newItemData ? newItemData.SpriteIndex : 0;
    }

    if (newItem.name === "Fishing Rod") {
      newItem.upgradeLevel = FishingRodUpgradeNumber.get(newItemData.Name) ?? 0;
      newItem.parentSheetIndex = 685;
      newItem.initialParentTileIndex =
        FishingRodSpriteIndex.get(newItemData.Name) ?? 0;
      newItem.indexOfMenuItemView = newItem.initialParentTileIndex;
    }

    if (newItemData._type === "Hat") {
      newItem.which = "";
    }

    if (newItemData._type === "Furniture") {
      newItem.canBeGrabbed = true;
      newItem.parentSheetIndex = newItemData.ParentSheetIndex;
      newItem.type = FurnitureTypeToNumber.get(newItemData.Type);

      // sourceRect is the sprite data, if I understand correctly
      if (newItemData.TilesheetSize !== -1) {
        newItem.sourceRect = {
          X: newItemData.Sprite.x,
          Y: newItemData.Sprite.y,
          Width: newItemData.TilesheetSize.width,
          Height: newItemData.TilesheetSize.height,
          Location: {
            X: newItemData.Sprite.x,
            Y: newItemData.Sprite.y,
          },
          Size: {
            X: newItemData.TilesheetSize.width,
            Y: newItemData.TilesheetSize.height,
          },
        };
        newItem.defaultSourceRect = newItem.sourceRect;
      }

      // Bounding box is the hitbox/placement box
      if (newItemData.BoundingBoxSize !== -1) {
        newItem.boundingBox = {
          X: 0,
          Y: 0,
          Width: newItemData.BoundingBoxSize.width,
          Height: newItemData.BoundingBoxSize.height,
          Size: {
            X: newItemData.BoundingBoxSize.width,
            Y: newItemData.BoundingBoxSize.height,
          },
          Location: {
            X: 0,
            Y: 0,
          },
        };

        newItem.defaultBoundingBox = newItem.boundingBox;
      }

      // If the item is a lamp, enable the lamp property
      if (newItemData.Type === FurnitureType.Lamp) {
        newItem.isLamp = true;
      }
    }

    if ("CanBeDyed" in newItemData && newItemData.CanBeDyed) {
      newItem.clothesColor = { R: 255, G: 255, B: 255, A: 255, PackedValue: 0 };
    }

    if (newItemData._type === "Object") {
      newItem.type = newItemData.Type as TypeEnum;
      if (newItemData._type === "Object" && newItemData.Type === "Ring") {
        // @ts-expect-error
        newItem["@_xsi:type"] = "Ring";
      }
    }

    if ("Edibility" in newItemData) {
      newItem.Price = newItemData.Edibility ?? -300;
    }

    if ("Price" in newItemData) {
      newItem.Price = newItemData.Price ?? 0;
    }

    if (typeof symbol === "number") {
      inventory[symbol] = newItem;
    } else {
      player[symbol] = newItem;
    }

    if (symbol === "hat" && newItem.name === "Copper Pan") {
      // @ts-expect-error This is exlusive to the copper pan
      newItem.ignoreHairstyleOffset = true;
      newItem.parentSheetIndex = 71;
      newItem.indexInTileSheet = 71;
      newItem.category = Category.Hat;
      // @ts-expect-error This is exlusive to the copper pan
      newItem.which = 71;
    }

    // Clear item from the editor window
    newItemName = "";

    // Select the new item
    selectedItem = newItem;
  };

  const rerender = (item: Item, index: ParentIndex) => {
    if (!player) return;

    if (typeof index === "number") {
      inventory[index] = item;
    } else {
      player[index] = item;
    }
  };
</script>

<!-- Data list for adding new items -->
<datalist id="new-items">
  {#each Array.from(itemData.keys()) as name}
    <option value={name} />
  {/each}
</datalist>

{#if player}
  <!-- Inventory view -->
  <Container>
    <div class="item-grid">
      {#each inventory as item, index}
        <SmallItem {item} {index} bind:selectedItem bind:selectedIndex />
      {/each}
    </div>
  </Container>

  <!-- Character View -->
  <Container>
    <div class="character-details">
      <div class="character-inner">
        <div class="character-group">
          <div class="character-armor">
            <SmallItem
              item={player.leftRing}
              index={"leftRing"}
              bind:selectedItem
              bind:selectedIndex />
            <SmallItem
              item={player.rightRing}
              index={"rightRing"}
              bind:selectedItem
              bind:selectedIndex />
            <SmallItem
              item={player.boots}
              index={"boots"}
              bind:selectedItem
              bind:selectedIndex />
          </div>
          <Preview
            pantsItem={player.pantsItem}
            shirtItem={player.shirtItem}
            hat={player.hat}
            gender={player.gender} />
          <div class="character-armor">
            <SmallItem
              item={player.hat}
              index={"hat"}
              bind:selectedItem
              bind:selectedIndex />
            <SmallItem
              item={player.shirtItem}
              index={"shirtItem"}
              bind:selectedItem
              bind:selectedIndex />
            <SmallItem
              item={player.pantsItem}
              index={"pantsItem"}
              bind:selectedItem
              bind:selectedIndex />
          </div>
        </div>

        <input type="text" class="character-name" bind:value={player.name} />
      </div>
      <div class="character-info">
        <label>
          <span hidden>Farm Name:</span>
          <input type="text" bind:value={player.farmName} />
          Farm
        </label>
        <label>
          Current Funds:
          <input type="number" bind:value={player.money} />
        </label>
        <label>
          Total Earnings:
          <input type="number" bind:value={player.totalMoneyEarned} />
        </label>
      </div>
    </div>
  </Container>

  <!-- Item view -->
  <Container>
    <div class="editor">
      <!-- Item icon -->
      <BigItem bind:item={selectedItem} />

      <!-- Item stats -->
      <div class="stats">
        {#if selectedItem}
          <label>
            <small>Item Name</small>
            <input type="text" value={selectedItem.name} disabled />
          </label>
          {#if selectedItemData}
            <!-- TODO: Since 1.6 removed stackable field, not sure how to actually know -->
            {#if !["Clothing", "Boots", "Hat", "Weapon", "Pants", "Shirt"].includes(selectedItemData._type)}
              <label>
                <small>Amount</small>
                <input
                  type="number"
                  bind:value={selectedItem.stack}
                  min="0"
                  max="999" />
              </label>
            {/if}
            {#if selectedItemData._type === "Weapon"}
              <label>
                <small>Min Dmg</small>
                <input
                  type="number"
                  bind:value={selectedItem.minDamage}
                  min="0" />
              </label>
              <label>
                <small>Max Dmg</small>
                <input
                  type="number"
                  bind:value={selectedItem.maxDamage}
                  min="0" />
              </label>
              <label>
                <small>Knockback</small>
                <input
                  type="number"
                  bind:value={selectedItem.knockback}
                  min="0" />
              </label>
              <label>
                <small>Speed</small>
                <input type="number" bind:value={selectedItem.speed} min="0" />
              </label>
              <label>
                <small>Added Precision</small>
                <input
                  type="number"
                  bind:value={selectedItem.addedPrecision}
                  min="0" />
              </label>
              <label>
                <small>Added Defense</small>
                <input
                  type="number"
                  bind:value={selectedItem.addedDefense}
                  min="0" />
              </label>
              <!-- {#if 'weaponType' in selectedItem}
                        <label>
                            <small>Weapon Type</small>
                            <select>
                                <option value="0">Stabbing Sword</option>
                                <option value="1">Dagger</option>
                                <option value="2">Club/Hammer</option>
                                <option value="3">Slashing Sword</option>
                            </select>
                        </label>
                    {/if} -->
              <label>
                <small>Added Area of Effect</small>
                <input
                  type="number"
                  bind:value={selectedItem.addedAreaOfEffect}
                  min="0" />
              </label>
              <label>
                <small>Crit Chance</small>
                <input
                  type="number"
                  bind:value={selectedItem.critChance}
                  min="0" />
              </label>
              <label>
                <small>Crit Dmg</small>
                <input
                  type="number"
                  bind:value={selectedItem.critMultiplier}
                  min="0" />
              </label>
            {:else if selectedItemData._type === "Tool"}
              <!-- Can't edit -->
            {:else if selectedItemData._type === "BigCraftable"}
              <!-- <label>
                        <small>Place Outdoors</small>
                        <input type="check" bind:value={selectedItem.setOutdoors} />
                    </label>
                    <label>
                        <small>Place Indoors</small>
                        <input type="check" bind:value={selectedItem.setIndoors} />
                    </label> -->
              <label>
                <small>Produces Light</small>
                <input type="checkbox" bind:checked={selectedItem.isLamp} />
              </label>
            {:else if selectedItemData._type === "Boots"}
              <label>
                <small>Added Defense</small>
                <input
                  type="number"
                  bind:value={selectedItem.defenseBonus}
                  min="0" />
              </label>
              <label>
                <small>Added Immunity</small>
                <input
                  type="number"
                  bind:value={selectedItem.immunityBonus}
                  min="0" />
              </label>
              <label>
                <small>Color Index</small>
                <input
                  type="number"
                  bind:value={selectedItem.indexInColorSheet}
                  min="0"
                  max="71"
                  on:change={() => {
                    if (!selectedItem) return;
                    // Force rerender on any other components watching this item
                    rerender(selectedItem, selectedIndex);
                  }} />
              </label>
            {:else if selectedItemData._type === "Shirt"}
              {#if selectedItemData.CanBeDyed}
                <label>
                  <small>Color</small>
                  <input
                    type="color"
                    value={RGBToHex(
                      selectedItem.clothesColor ?? {
                        R: 255,
                        G: 255,
                        B: 255,
                        A: 255,
                        PackedValue: 0,
                      }
                    )}
                    on:change={(e) => {
                      if (!selectedItem) return;
                      selectedItem.clothesColor = HexToRGB(
                        // @ts-expect-error
                        e.target.value ?? "#000000"
                      );

                      // Force rerender on any other components watching this item
                      rerender(selectedItem, selectedIndex);
                    }} />
                </label>
              {/if}
            {:else if selectedItemData._type === "Furniture"}
              <!-- Need more info -->
              <!-- House plant selector -->
            {:else if selectedItemData._type === "Hat"}
              <!-- Need more info? -->
            {/if}

            <!-- Quality selector -->
            <!-- svelte-ignore a11y-label-has-associated-control -->
            {#if selectedItem.quality !== 0 || (selectedItem.category && CategoriesWithQuality.has(selectedItem.category))}
              <label>
                <small>Quality</small>
                <QualitySelector bind:item={selectedItem} />
              </label>
            {/if}

            <!-- Edibility -->
            {#if selectedItemData && "edibility" in selectedItemData && selectedItemData.edibility !== -300}
              <label>
                <small>Edibility</small>
                <input
                  type="number"
                  bind:value={selectedItem.edibility}
                  min="0" />
              </label>
            {/if}

            <!-- Price -->
            {#if ["ObjectInformation", "BigCraftable", "Furniture", "Hat", "Clothing"].includes(selectedItemData._type)}
              <label>
                <small>Price</small>
                <input type="number" bind:value={selectedItem.price} min="0" />
              </label>
            {/if}
          {/if}
        {:else if selectedIndex}
          <label>
            <small>Item Name</small>
            <input type="text" list="new-items" bind:value={newItemName} />
          </label>
        {/if}
      </div>

      <!-- Delete/create the item -->
      <div class="edit">
        {#if selectedItem}
          <button
            class="btn btn-danger"
            on:click={() => deleteItem(selectedIndex)}>🗑️</button>
        {:else if selectedIndex}
          <button
            class="btn btn-success"
            on:click={() => createItem(selectedIndex)}>➕</button>
        {/if}
      </div>
    </div>
  </Container>
{/if}

<style>
  .item-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-auto-rows: 32px;
    grid-template-rows: 48px auto auto;
  }

  .editor {
    /* Three sections, edges are fix size, middle expands */
    display: grid;
    grid-template-columns: min-content 5fr 1fr;
    flex-direction: row;
    gap: 8px;
  }

  .stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .edit {
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
  }

  .edit button {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    margin-top: 16px;
    font-size: 1.5em;
    cursor: pointer;
  }

  .editor label {
    display: flex;
    width: 100%;
    flex-direction: row;
    gap: 2px;
    align-items: center;
    justify-content: space-between;
  }

  .editor small {
    margin-right: 2em;
  }

  .character-inner {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .character-details {
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: center;
  }

  .character-group {
    display: flex;
    flex-direction: row;
    gap: 4px;
  }

  .character-info {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    text-align: center;
    font-size: 1.2em;
    gap: 8px;
  }

  .character-info > label {
    display: block;
  }

  input[type="number"] {
    width: 6em;
  }

  .character-details input {
    text-align: center;
  }

  .character-name {
    width: 10em;
  }
</style>
