<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import type { FriendshipDataItem } from '../../../types/save/1.5.6';
    import Container from '../../Container.svelte';
    import HeartBar from './HeartBar.svelte';

    let characters: FriendshipDataItem[] = [];

    SaveGame.subscribe((save) => {
        if (!save) return;

        characters = save.SaveGame.player.friendshipData.item;
    });
</script>

<Container>
    <div class="wrapper">
        {#each characters as character}
            <HeartBar {character} />
        {/each}
    </div>
</Container>

<style>
    .wrapper {
        overflow-y: scroll;
        height: 20rem;
    }

    .inner {
    }
</style>
