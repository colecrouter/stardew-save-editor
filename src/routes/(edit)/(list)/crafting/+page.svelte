<script lang="ts">
    import { SaveGame } from '$lib/Upload';
    import type { KV } from '$types/save/1.5.6';
    import Container from '../../../Container.svelte';
    import List from '../List.svelte';
    import type { PageData } from './$types';

    export let data: PageData;
    const recipes = data.recipes;

    let recipesUnlocked: KV[];
    SaveGame.subscribe((s) => {
        if (!s) return;

        recipesUnlocked = s.SaveGame.player.craftingRecipes.item;
    });
</script>

<Container>
    <h3>Crafting Recipes</h3>
    <List keys={recipes} values={recipesUnlocked} />
</Container>
