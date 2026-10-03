<script lang="ts">
	interface Props {
		children: import("svelte").Snippet;
		text: string;
		disabled?: boolean;
		/** Show once when mounted, then fade out, instead of on hover/focus */
		flash?: boolean;
		id?: string;
	}

	let { children, text, disabled, flash, id }: Props = $props();
</script>

{#if disabled}
	{@render children()}
{:else}
	<div class="tooltip-wrapper" class:flash>
		{@render children()}
		<div class="tooltip">
			<div class="tooltip-content" role="tooltip" {id}>
				{text}
			</div>
		</div>
	</div>
{/if}

<style>
	.tooltip-wrapper {
		position: relative;
		height: max-content;
	}

	.tooltip {
		white-space: nowrap;
		position: absolute;
		z-index: 100;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		display: none; /* Hide by default */
		padding-bottom: 4px;
		pointer-events: none;
		touch-action: none;
	}

	.tooltip-wrapper:not(.flash):hover > .tooltip,
	.tooltip-wrapper:not(.flash):focus-within > .tooltip {
		display: block; /* Show on hover */
	}

	.tooltip-wrapper.flash > .tooltip {
		display: block;
		animation: tooltip-flash 1s ease-in forwards;
	}

	@keyframes tooltip-flash {
		0%,
		85% {
			opacity: 1;
			visibility: visible;
		}
		100% {
			opacity: 0;
			visibility: hidden;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tooltip-wrapper.flash > .tooltip {
			animation-timing-function: step-end;
		}
	}

	.tooltip-content {
		background: hsl(0, 0%, 20%);
		color: hsl(0, 0%, 98%);
		padding: 0.25em 0.5em;
		border-radius: 0.25em;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));
		border: solid 2px #555;
		pointer-events: none;
		user-select: none;
	}

	.tooltip-content::before {
		content: "";
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-top: 8px solid;
		border-top-color: inherit;
	}
</style>
