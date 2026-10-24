<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { asset } from "$app/paths";
	import Tooltip from "$lib/ui/Tooltip.svelte";

	type Props = HTMLButtonAttributes & {
		/** Tooltip and accessible name */
		label: string;
		/** Use the browser's tooltip, which isn't clipped by scrolling lists */
		nativeTooltip?: boolean;
	};

	let { label, nativeTooltip = false, ...rest }: Props = $props();

	// The game's Organize button: Cursors.png (162, 440), 16x16
	const sheet = `url(${asset("/assets/Cursors.png")})`;
</script>

{#snippet button()}
	<button
		type="button"
		class="sort"
		aria-label={label}
		title={nativeTooltip ? label : undefined}
		style:--sheet={sheet}
		{...rest}
	></button>
{/snippet}

{#if nativeTooltip}
	{@render button()}
{:else}
	<Tooltip text={label}>
		{@render button()}
	</Tooltip>
{/if}

<style>
	.sort {
		all: unset;
		display: block;
		width: 16px;
		height: 16px;
		zoom: 2;
		cursor: pointer;
		background-image: var(--sheet);
		background-position: -162px -440px;
		image-rendering: pixelated;
	}

	.sort:hover {
		filter: brightness(1.1);
	}

	.sort:focus-visible {
		outline: 1px solid #5b2b2a;
	}
</style>
