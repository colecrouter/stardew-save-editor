<script lang="ts">
	import type { Snippet } from "svelte";
	import Tooltip from "$lib/ui/Tooltip.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";

	type Props = HTMLButtonAttributes &
		HTMLAnchorAttributes & {
			children: Snippet;
			alt?: string;
			href?: string;
			active?: boolean;
			disabled?: boolean;

			[key: string]: unknown;
		};

	import type {
		HTMLAnchorAttributes,
		HTMLButtonAttributes,
	} from "svelte/elements";
	import { page } from "$app/stores";

	let {
		children,
		alt,
		href,
		disabled,
		active = false,
		...props
	}: Props = $props();
</script>

{#snippet content()}
	<UiContainerSmall>
		{@render children()}
	</UiContainerSmall>
{/snippet}

<Tooltip text={alt ?? ""} {disabled}>
	<div class="wrapper" class:disabled>
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
			<button {...props} aria-label={alt} class:active {disabled}>
				{@render content()}
			</button>
		{/if}
	</div>
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
	a:focus-within,
	button:hover,
	button:focus-within {
		outline: none;
		filter: brightness(0.85);
	}

	.active {
		filter: brightness(0.85);
	}

	.wrapper.disabled {
		filter: brightness(0.75);
		pointer-events: none;
		touch-action: none;
	}
</style>
