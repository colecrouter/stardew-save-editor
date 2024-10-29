<script lang="ts">
    import { run } from "svelte/legacy";

    import { base } from "$app/paths";
    import { DateableCharacters } from "$lib/NPCs";
    import type { FriendshipDataItem } from "$types/save/1.6";

    interface Props {
        character: FriendshipDataItem;
    }

    let { character = $bindable() }: Props = $props();

    let name = character.key.string;
    let dateable = DateableCharacters.some((c) => c == name);
    let amount: number = $state(character.value.Friendship.Points);
    let relationship: string = character.value.Friendship.Status;
    let hearts: number = $derived(Math.floor(amount / 250));
    let maxhearts: number = dateable
        ? relationship == "Married"
            ? 14
            : relationship == "Dating"
              ? 10
              : 8
        : 10;
    let maxamount: number = maxhearts * 250 + 249; // 250 points per heart, plus 249 points after the last heart

    // Update values for visuals
    run(() => {
        character.value.Friendship.Points = Math.max(
            Math.min(amount, maxamount),
            0,
        );
    });
</script>

<div class="row">
    <div class="portrait-wrapper">
        <div
            class="portrait"
            style:background-image={`url('${base}/assets/portraits/${name}.png')`}
        ></div>
    </div>
    <div class="right">
        <div class="hearts">
            {#each Array(hearts) as _, i}
                <span>❤️</span>
            {/each}
            {#each Array(maxhearts - hearts) as _, i}
                <span>🖤</span>
            {/each}
            {#each Array(14 - maxhearts) as _, i}
                <span>🏳️</span>
            {/each}
        </div>
        <input
            type="number"
            class="amount"
            min="0"
            max={maxamount}
            bind:value={amount}
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
        padding: 8px 0;
        border-bottom: 2px solid #da9457;
    }

    .portrait-wrapper {
        background-color: #d9ab6f;
        box-shadow:
            0 0 0 2px #b14e05,
            0 0 0 4px #dc7b05,
            0 0 0 6px #5b2b29;
        margin: 6px;
        box-sizing: border-box;
        border-radius: 1px;
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

    strong {
        text-align: center;
    }
</style>
