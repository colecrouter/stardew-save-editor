<script lang="ts">
    import { DateableCharacters } from '$lib/Characters';
    import type { FriendshipDataItem } from '../../../types/save/1.5.6';

    // export let character: string;
    // export let amount: number;

    export let character: FriendshipDataItem;

    let name = character.key.string;
    let dateable = DateableCharacters.some((c) => c == name);
    let amount = character.value.Friendship.Points;
    let relationship: string;
    let hearts: number;
    let maxhearts: number;

    // Update values for visuals
    $: relationship = character.value.Friendship.Status;
    $: hearts = Math.floor(amount / 250);
    $: maxhearts = dateable ? (relationship == 'Married' ? 14 : relationship == 'Dating' ? 10 : 8) : 10;

    // Reapply changes to amount
    $: character.value.Friendship.Points = Math.max(0, amount);
</script>

<div class="row">
    <div class="left">
        <div class="portrait" style:background-image={`url('/assets/portraits/${name}.png')`} />
        <strong>
            {name}
        </strong>
    </div>
    <div class="right">
        <div class="hearts">
            {#each Array(hearts) as _, i}
                ❤️
            {/each}
            {#each Array(maxhearts - hearts) as _, i}
                🖤
            {/each}
            {#each Array(14 - maxhearts) as _, i}
                🏳️
            {/each}
        </div>
        <input type="number" class="amount" bind:value={amount} />
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

    .portrait {
        width: 64px;
        height: 64px;
        background-size: 200% auto;
        margin-bottom: 2px;
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
    }

    .amount {
        width: 5em;
    }
</style>
