<script lang="ts">
	import "./styles.css";
	import type { HTMLButtonAttributes } from "svelte/elements";
	interface Props extends HTMLButtonAttributes {
		intent?: "neutral" | "constructive" | "destructive";
		variant?: "plain" | "filled";
		iconOnly?: boolean;
		pending?: boolean;
	}
	let {
		children,
		intent = "neutral",
		variant = "plain",
		iconOnly = false,
		pending = false,
		disabled = false,
		type = "button",
		class: className,
		"aria-busy": busy,
		...native
	}: Props = $props();
</script>

<!-- Intent identifies the action; variant controls emphasis independently. An
     icon-only button needs an accessible name from the caller.
     Forward native events and form attributes unchanged. Pending applies only
     when the caller chooses it; history controls must still allow queued blur edits. -->
<button
	{...native}
	{type}
	class={[
		"study-kit",
		"study-button",
		`study-button--${intent}`,
		`study-button--${variant}`,
		{ "study-button--icon": iconOnly },
		className,
	]}
	disabled={disabled || pending}
	aria-busy={pending || busy || undefined}
>
	{@render children?.()}
</button>
