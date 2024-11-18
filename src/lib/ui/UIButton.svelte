<script lang="ts">
    import Tooltip from "$lib/ui/Tooltip.svelte";
    import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        children: Snippet;
        alt?: string;
        href?: string;
        active?: boolean;
        [key: string]: unknown;
    }
    import { page } from "$app/stores";

    let { children, alt, href, active = false, ...props }: Props = $props();
</script>

{#snippet content()}
    <UiContainerSmall>
        {@render children()}
    </UiContainerSmall>
{/snippet}

<Tooltip text={alt ?? ""}>
    {#if href}
        <a
            {href}
            aria-label={alt}
            class:active={$page.url.pathname === href || active}
            {...props}
        >
            {@render content()}
        </a>
    {:else}
        <button {...props} aria-label={alt} class:active>
            {@render content()}
        </button>
    {/if}
</Tooltip>

<style>
    button,
    a {
        all: unset;
        border-radius: 2px;

        width: fit-content;
        height: fit-content;
        text-shadow: 0 0 2px #000;
        user-select: none;
        padding: 0.1em 0;
        cursor: pointer;
    }

    a:hover,
    button:hover {
        outline: revert;
        filter: brightness(0.85);
    }

    .active {
        filter: brightness(0.85);
    }
</style>
