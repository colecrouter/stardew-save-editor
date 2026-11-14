<script lang="ts">
	let {
		label,
		value,
		max,
		possible,
		valueText,
	}: {
		label: string;
		value: number;
		max: number;
		possible?: number;
		valueText?: string;
	} = $props();
	// The solid portion is verified progress. A hatched extension represents
	// only the possible additional credit from unreadable saved fields.
	const verified = $derived(Math.max(0, Math.min(max, value)));
	const upper = $derived(Math.max(verified, Math.min(max, possible ?? value)));
	const width = $derived(max > 0 ? (verified / max) * 100 : 0);
	const uncertainWidth = $derived(
		max > 0 ? ((upper - verified) / max) * 100 : 0,
	);
</script>

<span
	class="meter"
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={max}
	aria-valuenow={verified}
	aria-valuetext={valueText ??
		(upper === verified
			? `${verified} of ${max}`
			: `${verified} to ${upper} of ${max}; some progress is uncertain`)}
>
	<span class="verified" style:width={`${width}%`}></span>

	{#if uncertainWidth > 0}
		<span
			class="uncertain"
			style:left={`${width}%`}
			style:width={`${uncertainWidth}%`}
		></span>
	{/if}
</span>

<style>
	.meter {
		display: block;
		position: relative;
		height: 12px;
		width: 100%;
		overflow: hidden;
		border: 1px solid var(--study-rule);
		background: var(--study-paper-inset);
		box-shadow: inset 0 2px 0 #70401d12;
	}
	.verified,
	.uncertain {
		position: absolute;
		inset-block: 0;
	}
	.verified {
		left: 0;
		background: var(--study-action);
		box-shadow: inset 0 2px 0 #ffffff30;
	}
	.uncertain {
		background: repeating-linear-gradient(
			135deg,
			#b98b5266 0 4px,
			transparent 4px 8px
		);
	}
</style>
