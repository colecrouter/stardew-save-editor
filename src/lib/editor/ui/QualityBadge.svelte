<script lang="ts">
	let { quality }: { quality?: unknown } = $props();
	// Quality is sparse in the save format. Unknown/custom values must not be
	// pictured as a supported tier, and normal quality intentionally has no badge.
	const colors = $derived(
		quality === 1
			? { fill: "#dce6ee", shade: "#8196aa" }
			: quality === 2
				? { fill: "#ffe65a", shade: "#bf7c22" }
				: quality === 4
					? { fill: "#df91ed", shade: "#8844ab" }
					: undefined,
	);
</script>

{#if colors}
	<svg
		class="quality-badge"
		aria-hidden="true"
		width="14"
		height="14"
		viewBox="0 0 10 10"
		shape-rendering="crispEdges"
	>
		<!-- One stepped star silhouette keeps tier colors readable at inventory size. -->
		<path
			d="M4 0h2v2h1v1h3v3H8v1h1v3H6V9H4v1H1V7h1V6H0V3h3V2h1Z"
			fill="#56351f"
		/>
		<path
			d="M4 1h2v2h1v1h2v1H7v2h1v2H6V8H4v1H2V7h1V5H1V4h2V3h1Z"
			fill={colors.fill}
		/>
		<path d="M3 5h1v2H3Zm3 0h1v2H6ZM4 7h2v1H4Z" fill={colors.shade} />
	</svg>
{/if}
