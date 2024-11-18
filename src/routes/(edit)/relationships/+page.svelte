<script lang="ts">
    import { saveManager } from "$lib/save.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import HeartBar from "./HeartBar.svelte";

    const save = saveManager.save;
    if (!save) throw new Error("Save not found");

    if (!save.player) throw new Error("Character not found");

    let npcs = save.player.raw.friendshipData.item;
</script>

<UiContainer>
    <h3>Relationships</h3>
    <div class="wrapper">
        {#each npcs as character}
            <HeartBar npc={character} />
        {/each}
    </div>
</UiContainer>

<style>
    .wrapper {
        overflow-y: scroll;
        height: 20rem;
    }
</style>
