<script lang="ts">
    import { Character, SaveGame } from '$lib/SaveFile';
    import type { FriendshipDataItem } from '$types/save/1.6';
    import Container from '../../Container.svelte';
    import HeartBar from './HeartBar.svelte';

    let characters: FriendshipDataItem[] = [];
    Character.character.subscribe((c) => {
        if (!c) return;

        characters = c.friendshipData.item;
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
