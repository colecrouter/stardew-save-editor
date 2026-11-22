<script lang="ts">
	import { asset } from "$app/paths";

	let { size = 48 }: { size?: number } = $props();
</script>

<!-- The adjacent app name supplies the accessible identity. Reserve a square
     before loading so the mark cannot shift the upload or editor controls. -->
<img
	src={asset("img/ui/brand/app-mark.png")}
	width={size}
	height={size}
	alt=""
	aria-hidden="true"
	class="app-mark"
/>

<style>
	.app-mark {
		display: block;
		flex: none;
		object-fit: contain;
		/* Preserve the Photoshop export's pixel edges at both display sizes. */
		image-rendering: pixelated;
	}
</style>
