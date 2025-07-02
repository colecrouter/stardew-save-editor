<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import Recipes from "../List.svelte";

    const save = getSaveManager().save;
    if (!save) throw new Error("No save data found");
</script>

<Recipes recipes={save.player.craftingRecipes} />
