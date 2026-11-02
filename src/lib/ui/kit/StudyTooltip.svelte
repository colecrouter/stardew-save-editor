<script lang="ts">
	import "./styles.css";
	import { Tooltip } from "bits-ui";
	import type { Snippet } from "svelte";
	let {
		text,
		children,
		...native
	}: Omit<Tooltip.TriggerProps, "children" | "child"> & {
		text: string;
		children: Snippet;
	} = $props();
</script>

<!-- The trigger is the actual action button, never a wrapper around another
     button. Tooltip text supplements its visible name and is also described to AT. -->
<Tooltip.Provider delayDuration={250}>
	<Tooltip.Root>
		<Tooltip.Trigger
			{...native}
			class={["study-kit", "study-button", native.class]}
		>
			{@render children()}
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
