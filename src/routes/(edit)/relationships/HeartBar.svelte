<script lang="ts">
    import { base } from "$app/paths";
    import { DateableCharacters } from "$lib/NPCs";
    import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
    import type { FriendshipDataItem } from "$types/save/1.6";

    interface Props {
        npc: FriendshipDataItem;
    }

    const INTERVAL = 250;

    let { npc = $bindable() }: Props = $props();

    let name = npc.key.string;
    let dateable = DateableCharacters.some((c) => c === name);
    let amount: number = $state(npc.value.Friendship.Points);
    let relationship: string = npc.value.Friendship.Status;
    let hearts: number = $derived(Math.floor(amount / 250));
    let maxhearts: number = dateable
        ? relationship === "Married"
            ? 14
            : relationship === "Dating"
              ? 10
              : 8
        : 10;
    let maxamount: number = maxhearts * INTERVAL + INTERVAL - 1; // 250 points per heart, plus 249 points after the last heart

    function update(value: number) {
        npc.value.Friendship.Points = Math.floor(
            Math.max(0, Math.min(value, maxamount)),
        );
    }
</script>

<div class="row">
    <UiContainerSmall>
        <div
            class="portrait"
            style:background-image={`url('${base}/assets/portraits/${name}.png')`}
        ></div>
    </UiContainerSmall>
    <div class="right">
        <div class="hearts">
            {#each Array(hearts) as _, i}
                <button onclick={() => update(i * INTERVAL + INTERVAL)}>
                    ❤️
                </button>
            {/each}
            {#each Array(maxhearts - hearts) as _, i}
                <button
                    onclick={() =>
                        update(hearts * INTERVAL + i * INTERVAL + INTERVAL)}
                >
                    🖤
                </button>
            {/each}
            {#each Array(14 - maxhearts) as _}
                <span>🏳️</span>
            {/each}
        </div>
        <input
            type="number"
            class="amount"
            min="0"
            max={maxamount}
            bind:value={amount}
            onfocusout={() => update(amount)}
        />
    </div>
    <strong>
        {name}
    </strong>
</div>

<style>
    .row {
        display: grid;
        grid-template-columns: min-content auto;
        grid-template-rows: min-content 1em;
        flex-direction: row;
        gap: 8px;
        padding: 8px 2px;
        border-bottom: 2px solid #da9457;
    }

    .portrait {
        width: 64px;
        height: 64px;
        background-size: 200% auto;
        border: 2px solid #f0d2a8;
        border-radius: 2px;
    }

    .right {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: start;
        gap: 8px;
    }

    .hearts {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        width: 100%;
        text-shadow: -1px 1px 0 #000;
    }

    .amount {
        width: 5em;
    }

    button {
        all: unset;
    }

    strong {
        text-align: center;
    }
</style>
