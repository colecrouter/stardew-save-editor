<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	let { name }: { name: string } = $props();
	let failedName = $state<string>();
</script>

<!-- Portrait sheets use 64px frames. Crop the first expression at its native
     dimensions rather than shrinking the entire sheet. Unknown/modded names
     retain the same footprint and a readable initial if their image is absent. -->
<div class="portrait" aria-hidden="true">
	<span>{name.slice(0, 1)}</span>

	{#key name}
		<img
			src={dynamicAsset(`assets/portraits/${encodeURIComponent(name)}.png`)}
			alt=""
			loading="lazy"
			decoding="async"
			data-name={name}
			hidden={failedName === name}
			onerror={(event) => {
				// A late failure for a previous image must not hide a new villager.
				failedName = event.currentTarget.getAttribute("data-name") ?? undefined;
			}}
		/>
	{/key}
</div>

<style>
	.portrait {
		/* Keep a full 64px source frame inside the two-pixel border. */
		box-sizing: content-box;
		position: relative;
		flex: none;
		width: 64px;
		height: 64px;
		overflow: hidden;
		border: 2px solid #a57542;
		background: #f5dbab;
		image-rendering: pixelated;
	}
	span {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 28px;
		color: #79522d;
	}
	img {
		position: absolute;
		left: 0;
		top: 0;
		width: auto;
		height: auto;
		max-width: none;
		max-height: none;
	}
	img[hidden] {
		display: none;
	}
</style>
