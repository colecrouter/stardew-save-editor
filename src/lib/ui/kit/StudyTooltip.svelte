<script lang="ts">
	import "./styles.css";
	import { Tooltip } from "bits-ui";
	import type { Snippet } from "svelte";
	let {
		text,
		children,
		informative = false,
		...native
	}: Omit<Tooltip.TriggerProps, "children" | "child"> & {
		text: string;
		children: Snippet;
		/** Informational drawings stay focusable without implying a button action. */
		informative?: boolean;
	} = $props();
</script>

<!-- Actions keep native button semantics. Informational drawings use a named,
     focusable graphic so the same tooltip is available without mouse hovering,
     but do not advertise an action or acquire button hover/press styling. -->
<Tooltip.Provider delayDuration={250}>
	<Tooltip.Root>
		<Tooltip.Trigger
			{...native}
			class={[
				"study-kit",
				informative ? "study-information" : "study-button",
				native.class,
			]}
		>
			{#snippet child({ props })}
				{#if informative}
					{@const { type: _type, ...attributes } = props}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (A tooltip's informational graphic must be keyboard reachable.) -->
					<span {...attributes} role="img">
						{@render children()}
					</span>
				{:else}
					<button {...props}>
						{@render children()}
					</button>
				{/if}
			{/snippet}
		</Tooltip.Trigger>

		<Tooltip.Portal>
			<Tooltip.Content
				role="tooltip"
				sideOffset={8}
				class="study-kit study-tooltip"
			>
				{text}
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>

<style>
	:global(.study-information) {
		display: inline-flex;
		align-items: center;
		cursor: default;
		color: inherit;
	}
	:global(.study-information:focus-visible) {
		outline: 2px solid var(--study-focus);
		outline-offset: 2px;
	}
</style>
