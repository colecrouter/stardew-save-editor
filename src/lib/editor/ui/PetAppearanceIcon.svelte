<script lang="ts">
	import { asset } from "$app/paths";
	import type { PetAppearanceData } from "../../../../codegen/pets.ts";
	let { icon, label }: { icon: PetAppearanceData["icon"]; label: string } =
		$props();
</script>

<!-- Data/Pets supplies the 16px icon rectangle. Reserve scaled layout space
     separately so the pixel-art transform cannot overlap the adjacent text. -->
<span class="pet-icon" role="img" aria-label={`Vanilla appearance: ${label}`}>
	<span
		class="sprite"
		style:background-image={`url(${asset(icon.sheet)})`}
		style:background-position={`-${icon.x}px -${icon.y}px`}
	></span>
</span>

<style>
	.pet-icon {
		display: inline-block;
		width: 64px;
		height: 64px;
		flex: none;
	}
	.sprite {
		display: block;
		width: 16px;
		height: 16px;
		transform: scale(4);
		transform-origin: top left;
		image-rendering: pixelated;
	}
</style>
