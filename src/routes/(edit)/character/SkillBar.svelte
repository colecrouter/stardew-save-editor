<script lang="ts" context="module">
    const levels = [100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000];
</script>

<script lang="ts">
    export let skill: number;
</script>

<div class="wrapper">
    {#each levels as level}
        <div class="pill" class:active={skill >= level} on:click={() => (skill = level)} />
    {/each}
</div>

<style>
    .wrapper {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }

    .pill {
        width: 4px;
        height: 14px;
        background-color: #c87c1e;
        border: solid 4px;
        border-radius: 4px;
        border-top-color: #b26922;
        border-right-color: #b26922;
        border-bottom-color: #c98426;
        border-left-color: #c98426;
        margin: 0 6px;
        box-shadow: 0 0 0 2px #ca9133, 0 0 0 4px #8c5721, -2px 2px 0 4px rgba(0, 0, 0, 0.3);
        cursor: pointer;
    }

    .pill:nth-child(5n) {
        width: 24px;
    }

    .pill.active {
        width: 6px;
        height: 16px;
        margin: 0 5px;
        background-color: #dd003b;
        border-top-color: #ff6948;
        border-right-color: #ff6948;
        border-bottom-color: #bc004a;
        border-left-color: #bc004a;
        box-shadow: 0 0 0 3px #960027, -2px 2px 0 4px rgba(0, 0, 0, 0.3);
    }

    .pill.active:nth-child(5n) {
        width: 26px;
        background-color: #ffa400;
        border-top-color: #ffc62e;
        border-right-color: #ffc62e;
        border-bottom-color: #e06a00;
        border-left-color: #e06a00;
    }
</style>
