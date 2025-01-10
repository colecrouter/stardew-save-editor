<script lang="ts">
    import { ItemData } from "$lib/ItemData";
    import { Item } from "$lib/proxies/Item";
    import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
    import UiInput from "$lib/ui/UIInput.svelte";
    import ItemSprite from "./ItemSprite.svelte";

    interface Props {
        onsubmit: (name: string) => void;
    }

    let { onsubmit }: Props = $props();
    let filter = $state("");

    let values = $derived(
        [...ItemData.keys()]
            .filter((name) => name.toLowerCase().includes(filter.toLowerCase()))
            .slice(0, 4),
    );
</script>

<div class="wrapper">
    <UiInput
        type="text"
        list="new-items"
        data-testid="item-name"
        bind:value={filter}
    />

    <div class="menu">
        <UiContainerSmall>
            <div class="list">
                {#each values as name, i}
                    {@const submit = () => {
                        onsubmit(name);
                        filter = name;
                    }}
                    <button class="item" onclick={submit}>
                        <div class="icon">
                            <ItemSprite item={Item.fromName(name)} />
                        </div>
                        <div class="name">
                            {name}
                        </div>
                    </button>
                {/each}
                {#if values.length === 0}
                    <div class="item">
                        <div class="name">No items found</div>
                    </div>
                {/if}
            </div>
        </UiContainerSmall>
    </div>
</div>

<style>
    .wrapper {
        position: relative;
    }

    .menu {
        position: absolute;
        left: 0;
        z-index: 1;
        margin-top: 8px;
    }

    .list {
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .item {
        all: unset;
        width: 100%;
        display: flex;
        gap: 0.5rem;
        cursor: pointer;
        align-items: center;
        overflow-x: hidden;
    }

    .item:focus,
    .item:hover {
        backdrop-filter: brightness(0.8);
    }

    .icon :global(*) {
        pointer-events: none;
    }

    .menu {
        display: none;
        width: 100%;
    }

    .menu :global(> div) {
        width: 100%;
    }

    .wrapper:focus-within .menu,
    .wrapper:hover .menu {
        display: block;
    }
</style>
