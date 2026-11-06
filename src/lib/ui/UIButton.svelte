<script lang="ts">
	import "./controls.css";
	import type { Snippet } from "svelte";
	import Tooltip from "$lib/ui/Tooltip.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";

	type Props = HTMLButtonAttributes &
		HTMLAnchorAttributes & {
			children: Snippet;
			alt?: string;
			variant?: "framed" | "plain";
			href?: string;
			active?: boolean;
			disabled?: boolean;
			pending?: boolean;

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
		pending = false,
		active = false,
		variant = "framed",
		class: className,
		...props
	}: Props = $props();
	const unavailable = $derived(disabled || pending);
</script>

{#snippet content()}
	{#if variant === "plain"}{@render children()}{#if pending}<span
				aria-hidden="true"
			>
				…</span
			>{/if}{:else}
		<UiContainerSmall
			>{@render children()}{#if pending}<span aria-hidden="true">
					…</span
				>{/if}</UiContainerSmall
		>
	{/if}
{/snippet}

<Tooltip text={alt ?? ""} disabled={unavailable}>
	<div class={["wrapper", { disabled: unavailable }]}>
		{#if href}
			<a
				href={unavailable ? undefined : href}
				aria-label={props["aria-label"] ?? alt}
				{...props}
				role={unavailable ? "link" : props.role}
				aria-disabled={unavailable || undefined}
				aria-busy={pending || undefined}
				tabindex={unavailable ? -1 : props.tabindex}
				onclick={(event) => {
					if (unavailable) {
						event.preventDefault();
						event.stopImmediatePropagation();
						return;
					}
					(props.onclick as HTMLAnchorAttributes["onclick"])?.(event);
				}}
				class={[
					"ui-button",
					className,
					{
						plain: variant === "plain",
						active: $page.url.pathname === href || active,
					},
				]}
			>
				{@render content()}
			</a>
		{:else}
			<button
				{...props}
				aria-label={props["aria-label"] ?? alt}
				disabled={unavailable}
				aria-busy={pending || undefined}
				class={["ui-button", className, { plain: variant === "plain", active }]}
			>
				{@render content()}
			</button>
		{/if}
	</div>
</Tooltip>

<style>
	button,
	a {
		all: unset;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		min-height: 40px;
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
		filter: brightness(0.85);
	}

	.plain {
		box-sizing: border-box;
		width: 100%;
		min-height: 40px;
		padding: 6px 10px;
		border: 2px solid var(--ui-border-dark);
		border-radius: 4px;
		background: var(--ui-control-bg);
		color: var(--ui-control-text);
		text-shadow: none;
	}
	.ui-button:focus-visible {
		outline: 3px solid var(--ui-focus);
		outline-offset: 3px;
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
