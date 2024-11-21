<script lang="ts">
    import { saveManager } from "$lib/save.svelte";
    import Recipes from "../Recipes.svelte";
</script>

{#if saveManager.save}
    <Recipes recipes={saveManager.save.player.cookingRecipes} />
{/if}
