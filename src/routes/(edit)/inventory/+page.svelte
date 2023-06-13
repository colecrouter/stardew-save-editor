<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import type { Item as ItemType } from '../../../types/save/1.5.6';
    import Container from '../../Container.svelte';
    import Item from './Item.svelte';

    let hotbar: Array<string | ItemType> = [];
    let inventory: Array<string | ItemType> = [];
    SaveGame.subscribe((save) => {
        if (!save) return;

        hotbar = save.SaveGame.player.items.Item.slice(0, 12);
        inventory = save.SaveGame.player.items.Item.slice(12);
    });

    console.log('I LOADED TWOO');
</script>

<Container>
    <div class="group">
        {#each hotbar as item}
            <Item {item} />
        {/each}
    </div>
    <br />
    <div class="group">
        {#each inventory as item}
            <Item {item} />
        {/each}
    </div>
</Container>

<style>
    .group {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-auto-rows: 32px;
    }
</style>
