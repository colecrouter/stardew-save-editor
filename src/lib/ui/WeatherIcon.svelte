<script lang="ts">
	import { weatherIconUrl } from "./weatherIcons";
	let { weather, season }: { weather: string; season: string } = $props();
	const url = $derived(weatherIconUrl(weather, season));
</script>

{#if url}
	<img
		class="weather-icon"
		src={url}
		alt=""
		aria-hidden="true"
		width="39"
		height="39"
	/>
{:else}
	<svg
		class="weather-icon"
		width="39"
		height="39"
		viewBox="0 0 13 13"
		aria-hidden="true"
		focusable="false"
		shape-rendering="crispEdges"
	>
		<path
			fill="#775231"
			d="M4 1h5v1h1v4H9v1H7v2H5V6h2V5h1V3H5v1H3V2h1zM5 10h2v2H5z"
		/>
	</svg>
{/if}

<style>
	.weather-icon {
		display: block;
		width: 39px;
		height: 39px;
		flex: none;
		image-rendering: pixelated;
	}
</style>
