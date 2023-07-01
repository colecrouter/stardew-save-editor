<script lang="ts">
    import { DateableCharacters } from '$lib/NPCs';
    import type { FriendshipDataItem } from '../../../types/save/1.5';

    // export let character: string;
    // export let amount: number;

    export let character: FriendshipDataItem;

    let name = character.key.string;
    let dateable = DateableCharacters.some((c) => c == name);
    let amount: number;
    let relationship: string;
    let hearts: number;
    let maxhearts: number;

    // Update values for visuals
    $: amount = character.value.Friendship.Points;
    $: relationship = character.value.Friendship.Status;
    $: hearts = Math.floor(amount / 250);
    $: maxhearts = dateable ? (relationship == 'Married' ? 14 : relationship == 'Dating' ? 10 : 8) : 10;
</script>

<div class="row">
    <div class="left">
        <div class="portrait-wrapper">
            <div class="portrait" style:background-image={`url('/assets/portraits/${name}.png')`} />
        </div>
        <strong>
            {name}
        </strong>
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
        <input type="number" class="amount" bind:value={amount} on:change={() => (character.value.Friendship.Points = Math.max(0, amount))} />
    </div>
</div>

<style>
    .row {
        display: flex;
        flex-direction: row;
        gap: 8px;
        padding: 8px 0;
        border-bottom: 2px solid #da9457;
        text-align: center;
    }

    .portrait-wrapper {
        background-color: #d9ab6f;
        box-shadow: 0 0 0 2px #b14e05, 0 0 0 4px #dc7b05, 0 0 0 6px #5b2b29;
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
        justify-content: center;
        align-items: center;
        gap: 8px;
    }

    .hearts {
        text-shadow: -1px 1px 0 #000;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
    }

    .amount {
        width: 5em;
    }
</style>
