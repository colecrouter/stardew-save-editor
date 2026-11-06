<script lang="ts">
	import "./controls.css";
	import type { Snippet } from "svelte";
	import type { HTMLSelectAttributes } from "svelte/elements";

	type Props = Omit<HTMLSelectAttributes, "value"> & {
		value: string | number;
		children: Snippet;
	};

	let {
		value = $bindable(),
		children,
		class: className,
		...props
	}: Props = $props();
</script>

<span class="select-wrapper">
	<select bind:value {...props} class={["ui-control", className]}>
		{@render children()}
	</select>
</span>

<style>
	.select-wrapper {
		position: relative;
		display: block;
		width: 100%;
	}

	.select-wrapper::after {
		position: absolute;
		right: 16px;
		top: 50%;
		width: 8px;
		height: 8px;
		border-right: 2px solid #5b2b29;
		border-bottom: 2px solid #5b2b29;
		transform: translateY(-70%) rotate(45deg);
		pointer-events: none;
		content: "";
	}

	select {
		appearance: none;
		width: 100%;
		padding: 6px 36px 6px 10px;
		cursor: pointer;
	}
</style>
