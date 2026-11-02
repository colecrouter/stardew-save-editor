<script lang="ts">
	import "./styles.css";
	import { Popover } from "bits-ui";
	import type { Snippet } from "svelte";
	let {
		trigger,
		title,
		children,
		open = $bindable(false),
	}: {
		trigger: string;
		title: string;
		children: Snippet;
		open?: boolean;
	} = $props();
	const id = $props.id();
</script>

<!-- Rich help uses a nonmodal, explicitly opened panel. Bits owns positioning,
     Escape and trigger-focus restoration; the caller owns the displayed content. -->
<Popover.Root bind:open>
	<Popover.Trigger class="study-kit study-button">{trigger}</Popover.Trigger>

	<Popover.Portal>
		<Popover.Content
			class="study-kit study-popover"
			role="dialog"
			aria-modal="false"
			sideOffset={8}
			aria-labelledby={id}
			trapFocus={false}
		>
			<h3 {id}>{title}</h3>

			{@render children()}

			<Popover.Close class="study-button study-popover-close">
				Close help
			</Popover.Close>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
