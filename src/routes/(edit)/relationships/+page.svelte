<script lang="ts">
    import { saveManager } from "$lib/save.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import HeartBar from "./HeartBar.svelte";

    const save = saveManager.save;
    if (!save) throw new Error("Save not found");
</script>

<UiContainer>
    {#key save.player}
        <h3>Relationships</h3>
        <div class="wrapper">
            {#each save.player.raw.friendshipData.item as character}
                <HeartBar bind:npc={character} />
            {/each}
        </div>
    {/key}
</UiContainer>

<style>
    .wrapper {
        overflow-y: scroll;
        height: 20rem;
    }
</style>
