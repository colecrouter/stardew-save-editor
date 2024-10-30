<script lang="ts">
    import { Character, SaveGame } from "$lib/SaveFile";
    import { saveManager } from "$lib/SaveFile.svelte";
    import type { FriendshipDataItem } from "$types/save/1.6";
    import Container from "../../Container.svelte";
    import HeartBar from "./HeartBar.svelte";

    if (!saveManager.player) throw new Error("Character not found");

    let npcs = saveManager.player.friendshipData.item;
</script>

<Container>
    <h3>Relationships</h3>
    <div class="wrapper">
        {#each npcs as character}
            <HeartBar npc={character} />
        {/each}
    </div>
</Container>

<style>
    .wrapper {
        overflow-y: scroll;
        height: 20rem;
    }
</style>
