<script lang="ts">
	import "./styles.css";
	import type { HTMLButtonAttributes } from "svelte/elements";
	interface Props extends HTMLButtonAttributes {
		variant?: "default" | "primary" | "danger";
		pending?: boolean;
	}
	let {
		children,
		variant = "default",
		pending = false,
		disabled = false,
		type = "button",
		class: className,
		"aria-busy": busy,
		...native
	}: Props = $props();
</script>

<!-- Forward native events and form attributes unchanged. Pending applies only
     when the caller chooses it; history controls must still allow queued blur edits. -->
<button
	{...native}
	{type}
	class={["study-kit", "study-button", `study-button--${variant}`, className]}
	disabled={disabled || pending}
	aria-busy={pending || busy || undefined}
>
	{@render children?.()}
</button>
