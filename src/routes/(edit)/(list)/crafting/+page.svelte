<script lang="ts">
    import { Character, SaveGame } from "$lib/SaveFile";
    import type { KV } from "$types/save/1.5";
    import Container from "../../../Container.svelte";
    import List from "../List.svelte";
    import type { PageData } from "./$types";

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();
    const recipes = data.recipes;

    let recipesUnlocked: KV[] = $state([]);
    Character.character.subscribe((c) => {
        if (!c) return;

        recipesUnlocked = c.craftingRecipes?.item ?? [];
    });
</script>

<Container>
    <h3>Crafting Recipes</h3>
    <List keys={recipes} values={recipesUnlocked} />
</Container>
