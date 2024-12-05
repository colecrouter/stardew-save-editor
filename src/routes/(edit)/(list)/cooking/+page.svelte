<script lang="ts">
    import { saveManager } from "$lib/SaveManager.svelte";
    import Recipes from "../Recipes.svelte";

    const save = saveManager.save;
    if (!save) throw new Error("No save data found");
</script>

{#key save.player}
    <Recipes recipes={save.player.cookingRecipes} />
{/key}
