<script lang="ts">
    import type { ParentIndex } from "$lib/ItemParentIndex";
    import type { Item, Player } from "$types/save/1.6";
    import Preview from "../appearance/Preview.svelte";
    import SmallItem from "./SmallItem.svelte";

    interface Props {
        player: Player;
        selectedItem: Item | undefined;
        selectedIndex: ParentIndex;
    }

    let {
        player = $bindable(),
        selectedItem = $bindable(),
        selectedIndex = $bindable(),
    }: Props = $props();
</script>

<div class="character-details">
    <div class="character-inner">
        <div class="character-group">
            <div class="character-armor">
                <SmallItem
                    item={player.leftRing}
                    index={"leftRing"}
                    bind:selectedItem
                    bind:selectedIndex
                />
                <SmallItem
                    item={player.rightRing}
                    index={"rightRing"}
                    bind:selectedItem
                    bind:selectedIndex
                />
                <SmallItem
                    item={player.boots}
                    index={"boots"}
                    bind:selectedItem
                    bind:selectedIndex
                />
            </div>
            <Preview
                pantsItem={player.pantsItem}
                shirtItem={player.shirtItem}
                hat={player.hat}
                gender={player.gender}
            />
            <div class="character-armor">
                <SmallItem
                    item={player.hat}
                    index={"hat"}
                    bind:selectedItem
                    bind:selectedIndex
                />
                <SmallItem
                    item={player.shirtItem}
                    index={"shirtItem"}
                    bind:selectedItem
                    bind:selectedIndex
                />
                <SmallItem
                    item={player.pantsItem}
                    index={"pantsItem"}
                    bind:selectedItem
                    bind:selectedIndex
                />
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

<style>
    .character-details input {
        text-align: center;
    }

    .character-name {
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
</style>
