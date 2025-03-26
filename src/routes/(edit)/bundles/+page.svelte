<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import Bundle from "./Bundle.svelte";

    const save = getSaveManager().save;
    const bundles = save?.communityBundles;
    if (!save || !bundles) throw new Error("No save data found");

    // Woohoo, side effects!
    // I can't think of a good way to implement this in the logic without making it more complex
    $effect(() => {
        bundles.applySideEffects(save);
    });
</script>

<UiContainer>
    <div class="warning">
        <h2>Under Construction 🏗️</h2>
        <p>Parts of this page are still being worked on.</p>
    </div>

    <div class="wrapper">
        {#each bundles.bundles as bundle}
            <Bundle {bundle} />
        {/each}
    </div>
</UiContainer>

<style>
    .warning {
        background-color: rgba(255, 0, 0, 0.35);
        border-left: solid 4px rgba(255, 0, 0, 0.7);
    }

    .warning > * {
        padding: 0.2rem;
        padding-left: 0.5rem;
        margin-block-start: 0.2em;
        margin-block-end: 0.2em;
    }

    .wrapper {
        height: 320px;
        overflow-y: auto;
    }
</style>
