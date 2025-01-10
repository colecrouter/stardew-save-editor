<script lang="ts">
    import type { Recipes } from "$lib/proxies/Recipes";
    import UiCheckbox from "$lib/ui/UICheckbox.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import List from "./List.svelte";

    interface Props {
        recipes: Recipes<"cookingRecipes" | "craftingRecipes">;
    }

    let { recipes = $bindable() }: Props = $props();

    let cache = recipes.recipes;
</script>

<UiContainer>
    <h3>Crafting Recipes</h3>
    <List record={cache} {input} />
</UiContainer>

{#snippet input(key: string)}
    <UiCheckbox
        checked={cache[key]!}
        data-testid={`recipe-${key.toLowerCase()}`}
        onchange={() =>
            (recipes.recipes = {
                ...cache,
                [key]: !cache[key],
            })}
    />
{/snippet}
