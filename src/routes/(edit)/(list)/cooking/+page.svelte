<script lang="ts">
    import { saveManager } from "$lib/SaveFile.svelte";
    import type { KV } from "$types/save/1.5";
    import Container from "../../../Container.svelte";
    import List from "../List.svelte";
    import type { PageData } from "./$types";

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();
    const recipes = data.recipes;

    if (!saveManager.player) throw new Error("Character not found");
    let recipesUnlocked: KV[] = saveManager.player.cookingRecipes.item;
</script>

<Container>
    <h3>Cooking Recipes</h3>
    <List keys={recipes} values={recipesUnlocked} />
</Container>
