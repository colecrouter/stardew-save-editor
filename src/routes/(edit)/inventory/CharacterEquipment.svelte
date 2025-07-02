<script lang="ts">
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import type { Farmer } from "$lib/proxies/Farmer.svelte";
    import UiInput from "$lib/ui/UIInput.svelte";
    import Preview from "../appearance/CharacterPreview.svelte";
    import ItemSlot from "./ItemSlot.svelte";
    import ItemSprite from "./ItemSprite.svelte";
    interface Props {
        player: Farmer;
        selectedIndex: ParentIndex;
    }

    let { player = $bindable(), selectedIndex = $bindable() }: Props = $props();

    function handleClick(index: ParentIndex) {
        selectedIndex = index;
    }
</script>

{#snippet slot(index: ParentIndex)}
    <ItemSlot
        data-testid={`item-${index}`}
        onclick={() => handleClick(index)}
        active={selectedIndex === index}
    >
        <ItemSprite item={player.inventory.getItem(index)} />
    </ItemSlot>
{/snippet}

<div class="character-details">
    <div class="character-inner">
        <div class="character-group">
            <div class="character-armor">
                {@render slot("leftRing")}
                {@render slot("rightRing")}
                {@render slot("boots")}
            </div>
            <Preview {player} />
            <div class="character-armor">
                {@render slot("hat")}
                {@render slot("shirtItem")}
                {@render slot("pantsItem")}
            </div>
        </div>

        <div class="character-name">
            <UiInput type="text" bind:value={player.name} />
        </div>
    </div>
    <div class="character-info">
        <label>
            <span hidden>Farm Name:</span>
            <UiInput
                type="text"
                bind:value={player.farmName}
                data-sentry-mask
            />
            Farm
        </label>
        <label>
            Current Funds:
            <UiInput type="number" bind:value={player.money} />
        </label>
        <label>
            Total Earnings:
            <UiInput type="number" bind:value={player.totalMoneyEarned} />
        </label>
    </div>
</div>

<style>
    .character-details :global(input) {
        text-align: center;
    }

    .character-name :global(input) {
        width: 10em;
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

    .character-info :global(input[type="number"]) {
        width: 6em;
    }
</style>
