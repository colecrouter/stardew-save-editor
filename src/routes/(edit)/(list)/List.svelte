<script lang="ts">
    import type { Snippet } from "svelte";
    import ItemSprite from "../inventory/ItemSprite.svelte";
    import { recipeMapping } from "./mapping";
    import { Item } from "$lib/proxies/Item";

    interface Props {
        record: Record<string, unknown>;
        input?: Snippet<[string]>;
    }

    let { record = $bindable(), input }: Props = $props();

    let filter = $state("");
    let regex = $derived(new RegExp(filter, "i"));
    let filtered = $derived(
        Object.keys(record).filter((e) => e.search(regex) !== -1),
    );
</script>

<input type="text" placeholder="Search..." bind:value={filter} />

<div class="wrapper">
    {#each filtered as key}
        <label class="entry">
            <div class="key">
                <div class="img">
                    <ItemSprite
                        item={Item.fromName(recipeMapping.get(key) ?? key)}
                    />
                </div>
                {key}
            </div>

            {@render input?.(key)}
        </label>
    {/each}
</div>

<style>
    input[type="text"] {
        width: 100%;
        margin: 4px;
        margin-bottom: 8px;
        font-size: large;
    }

    .wrapper {
        display: flex;
        flex-direction: column;
        height: 20rem;
        overflow-y: scroll;
    }

    .entry {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: #5b2b2a 1px solid;
        padding-left: 0.5em;
        margin: 2px 0;
    }

    .key {
        display: flex;
        align-items: center;
        gap: 4px;
        padding-bottom: 2px;
    }

    .img {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
