<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLSelectAttributes } from "svelte/elements";

	type Props = Omit<HTMLSelectAttributes, "value"> & {
		value: string | number;
		children: Snippet;
	};

	let { value = $bindable(), children, ...props }: Props = $props();
</script>

<span class="select-wrapper">
	<select bind:value {...props}>
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
		min-height: 36px;
		padding: 6px 36px 6px 10px;
		border: solid 2px;
		border-radius: 4px;
		border-bottom-color: #9c613b;
		border-left-color: #9c613b;
		border-right-color: #6f3b31;
		border-top-color: #6f3b31;
		background-color: #f9bb65;
		box-shadow:
			inset -2px 2px 0 #e38813,
			-2px 2px 1px rgba(0, 0, 0, 0.2);
		color: #3f2117;
		font: inherit;
		cursor: pointer;
	}

	select:focus-visible {
		outline: 2px solid #5b2b29;
		outline-offset: 2px;
	}
</style>
