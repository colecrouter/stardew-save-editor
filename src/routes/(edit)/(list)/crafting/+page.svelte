<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import Recipes from "../Recipes.svelte";

    const save = getSaveManager().save;
    if (!save) throw new Error("No save data found");
</script>

{#key save.player}
    <Recipes recipes={save.player.craftingRecipes} />
{/key}
