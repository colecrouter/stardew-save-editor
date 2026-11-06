<script lang="ts">
	import "./styles.css";
	import type { Snippet } from "svelte";
	let {
		title,
		surface = "paper",
		children,
	}: {
		title?: string;
		surface?: "paper" | "inset" | "plain";
		children: Snippet;
	} = $props();
	const id = $props.id();
</script>

<!-- A title names the section; an untitled panel remains an ordinary grouping.
     Layout and field lifetimes stay with the caller, not this visual container. -->
<section
	class={["study-kit", "study-panel", `study-panel--${surface}`]}
	aria-labelledby={title ? id : undefined}
>
	{#if title}
		<h2 class="study-panel-heading" {id}>{title}</h2>
	{/if}

	{@render children()}
</section>
