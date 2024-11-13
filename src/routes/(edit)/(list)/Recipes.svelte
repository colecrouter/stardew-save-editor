<script lang="ts">
    import type { Recipes } from "$lib/proxies/Recipes";
    import Container from "../../Container.svelte";
    import List from "./List.svelte";

    interface Props {
        recipes: Recipes<"cookingRecipes" | "craftingRecipes">;
    }

    let { recipes = $bindable() }: Props = $props();

    let cache = recipes.recipes;
</script>

<Container>
    <h3>Crafting Recipes</h3>
    <List record={cache} {input} />
</Container>

{#snippet input(key: string)}
    <input
        type="checkbox"
        name={key}
        checked={cache[key]}
        onchange={() =>
            (recipes.recipes = {
                ...cache,
                [key]: !cache[key],
            })}
    />
{/snippet}

<style>
    input[type="checkbox"] {
        position: relative;
        appearance: none;
        width: 1.2rem;
        height: 1.2rem;
        border: solid 2px #5b2b2a;
        box-shadow: inset -2px 2px 0px #976d42;
        cursor: pointer;
    }

    input[type="checkbox"]:hover {
        filter: brightness(1.15);
    }

    input[type="checkbox"]:checked::after {
        position: absolute;
        top: -0.25rem;
        left: -0.175rem;
        color: transparent;
        text-shadow: 0 0 0 #32c523;
        content: "❌";
        font-weight: bold;
        font-size: 1.2em;
    }
</style>
