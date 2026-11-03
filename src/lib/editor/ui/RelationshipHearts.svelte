<script lang="ts">
	let {
		points,
		maxHearts,
		present,
	}: { points?: number; maxHearts: number; present: boolean } = $props();
</script>

<!-- Points retain fractional heart progress; the exact editable value remains
     alongside this read-only game-style summary. Never infer or change status. -->
<div
	class="hearts"
	role="img"
	aria-label={present && points !== undefined
		? `${Math.min(maxHearts, Math.max(0, points / 250)).toLocaleString(undefined, { maximumFractionDigits: 2 })} of ${maxHearts} hearts; ${points.toLocaleString()} points`
		: present
			? "Friendship unavailable"
			: "No saved friendship"}
>
	{#each Array.from({ length: maxHearts }, (_, index) => index) as heart (heart)}
		<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
			<path
				fill="#bca17a"
				d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z"
			/>
			<path
				fill="#c44d3f"
				style:clip-path={`inset(0 ${100 - Math.max(0, Math.min(1, (points ?? 0) / 250 - heart)) * 100}% 0 0)`}
				d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z"
			/>
		</svg>
	{/each}
</div>

<style>
	.hearts {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		min-height: 16px;
	}
	svg {
		display: block;
		flex: none;
	}
</style>
