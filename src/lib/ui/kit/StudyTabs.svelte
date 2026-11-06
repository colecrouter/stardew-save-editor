<script lang="ts">
	import "./styles.css";
	import { Tabs } from "bits-ui";
	import type { Snippet } from "svelte";
	interface Tab {
		value: string;
		label: string;
		disabled?: boolean;
		content: Snippet;
	}
	let {
		label,
		items,
		value = $bindable(""),
	}: {
		label: string;
		items: readonly Tab[];
		value: string;
	} = $props();
</script>

<!-- Manual activation lets arrows explore without changing an editor. Retained
     panels preserve local drafts; hidden removes inactive controls from focus/AT. -->
<Tabs.Root bind:value activationMode="manual" class="study-kit">
	<Tabs.List aria-label={label} class="study-tabs-list">
		{#each items as item (item.value)}
			<Tabs.Trigger
				value={item.value}
				disabled={item.disabled}
				class="study-tab"
			>
				{item.label}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>

	{#each items as item (item.value)}
		<Tabs.Content
			value={item.value}
			hidden={value !== item.value}
			class="study-tab-panel"
		>
			{@render item.content()}
		</Tabs.Content>
	{/each}
</Tabs.Root>
