<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import type { FriendshipDataItem } from '../../../types/save/1.5.6';
    import Container from '../../Container.svelte';
    import HeartBar from './HeartBar.svelte';

    let characters: FriendshipDataItem[] = [];
    SaveGame.subscribe((s) => {
        if (!s) return;

        characters = s.SaveGame.player.friendshipData.item;
    });
</script>

<Container>
    <h3>Relationships</h3>
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
</style>
