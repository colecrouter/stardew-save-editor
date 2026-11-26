<script lang="ts">
	import StudyTooltip from "$lib/ui/kit/StudyTooltip.svelte";

	let {
		name,
		pressed,
		disabled = false,
		sprite,
		fallback,
		choose,
	}: {
		name: string;
		pressed: boolean;
		disabled?: boolean;
		sprite?:
			| { url: string; x: number; y: number; width: number; height: number }
			| undefined;
		fallback: string;
		choose: () => void;
	} = $props();
	// Give small tiles a little more space, and fit taller sprites inside the
	// same hit area without changing the crop's proportions.
	const scale = $derived(
		sprite ? Math.min(1.5, 28 / Math.max(sprite.width, sprite.height)) : 1,
	);
</script>

<StudyTooltip
	text={name}
	aria-label={name}
	aria-pressed={pressed}
	{disabled}
	type="button"
	class="location-sprite-choice"
	onclick={choose}
>
	<!-- Animate the art alone so the hit target stays under the pointer. -->
	<span
		class="art"
		class:pressed
		aria-hidden="true"
	>
		{#if sprite}
			<span
				class="sprite"
				style:width={`${sprite.width}px`}
				style:height={`${sprite.height}px`}
				style:--sprite-scale={scale}
				style:--sprite={`url("${sprite.url}")`}
				style:--sprite-position={`${-sprite.x}px ${-sprite.y}px`}
			></span>
		{:else}
			<span class="fallback">{fallback}</span>
		{/if}
	</span>
</StudyTooltip>

<style>
	:global(.study-kit.study-button.location-sprite-choice) {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		min-height: 44px;
		padding: 0;
	}

	:global(.location-sprite-choice[aria-pressed="true"]) {
		outline: 2px solid #37797c;
		outline-offset: -3px;
	}

	:global(.location-sprite-choice:focus-visible) {
		outline: 2px solid var(--study-focus, #234f75);
		outline-offset: 2px;
	}

	.art {
		display: grid;
		place-items: center;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		width: 30px;
		height: 30px;
		opacity: 0.62;
		transition:
			opacity 120ms ease,
			transform 120ms ease,
			filter 120ms ease;
	}

	.art.pressed {
		opacity: 1;
		transform: translateY(-2px);
		filter: drop-shadow(0 2px 1px #38241270);
	}

	.sprite {
		background: var(--sprite) no-repeat var(--sprite-position);
		image-rendering: pixelated;
		transform: scale(var(--sprite-scale));
	}

	.fallback {
		font-size: 0.75rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.art {
			transition: none;
		}
	}
</style>
