<script lang="ts">
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		label: string;
		emoji: string;
		value: number;
		max: number;
	}

	let { label, emoji, value = $bindable(), max }: Props = $props();

	// Calculate percentage for the bar width
	let percentage = $derived(Math.min((value / max) * 100, 100));
</script>

<div class="stat-bar">
	<label>
		<small>{label}</small>
		<div class="bar-container">
			<div class="bar" style:width="{percentage}%">
				<span class="fill">{emoji}</span>
			</div>
		</div>
		<UiInput type="number" min={0} {max} bind:value />
	</label>
</div>

<style>
	.stat-bar {
		width: 100%;
	}

	.stat-bar label {
		display: grid;
		grid-template-columns: 80px 1fr 60px;
		align-items: center;
		gap: 8px;
	}

	.bar-container {
		height: 20px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.3);
	}

	.bar {
		height: 100%;
		background: linear-gradient(90deg, #4caf50, #8bc34a);
		transition: width 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.fill {
		padding-right: 4px;
		font-size: 12px;
		white-space: nowrap;
	}
</style>
