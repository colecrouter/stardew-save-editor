<script lang="ts">
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		value: number;
		max: number;
		total?: number;
		inputValue?: number;
		inputMin?: number;
		inputMax?: number;
		inputStep?: number;
		inputTestId?: string;
		justify?: "start" | "end" | "between";
		filled: string;
		empty?: string;
		locked?: string;
		testId?: string;
		ariaLabel?: string;
		onChange?: (value: number) => void;
		onInputChange?: (value: number) => void;
	}

	let {
		value = $bindable(),
		max,
		total = max,
		inputValue = $bindable(),
		inputMin = 0,
		inputMax,
		inputStep = 1,
		inputTestId,
		justify = inputMax !== undefined ? "between" : "start",
		filled,
		empty = filled,
		locked = "",
		testId,
		ariaLabel = "Set value",
		onChange,
		onInputChange,
	}: Props = $props();

	function update(next: number) {
		value = next;
		onChange?.(next);
	}

	function getInputValue() {
		return inputValue ?? 0;
	}

	function setInputValue(next: number | string) {
		if (typeof next !== "number" || Number.isNaN(next)) return;
		inputValue = next;
		onInputChange?.(next);
	}
</script>

<div
	class="range-wrap"
	class:end={justify === "end"}
	class:between={justify === "between"}
>
	<div class="range" role="group" aria-label={ariaLabel}>
		{#each Array(max) as _, i (i)}
			<button
				type="button"
				class:active={i < value}
				data-testid={testId}
				aria-pressed={i < value}
				aria-label={`${ariaLabel} ${i + 1}`}
				onclick={() => update(i + 1)}
			>
				{i < value ? filled : empty}
			</button>
		{/each}

		{#each Array(Math.max(0, total - max)) as _, i (i)}
			<span class="locked">{locked}</span>
		{/each}
	</div>

	{#if inputMax !== undefined}
		<div class="numeric">
			<UiInput
				type="number"
				min={inputMin}
				max={inputMax}
				step={inputStep}
				data-testid={inputTestId}
				bind:value={getInputValue, setInputValue}
			/>
			<small>/ {inputMax}</small>
		</div>
	{/if}
</div>

<style>
	.range-wrap {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem 0.6rem;
	}

	.range-wrap.end {
		justify-content: flex-end;
	}

	.range-wrap.between {
		width: 100%;
		justify-content: space-between;
	}

	.range {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.15rem;
	}

	button,
	.locked {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		font-size: 1.1rem;
		line-height: 1;
	}

	button {
		all: unset;
		cursor: pointer;
		border-radius: 999px;
		text-align: center;
		color: #6f3b31;
		opacity: 0.7;
		text-shadow: -1px 1px 0 rgba(0, 0, 0, 0.18);
		transition:
			transform 120ms ease,
			color 120ms ease,
			opacity 120ms ease;
	}

	button:hover {
		transform: translateY(-1px) scale(1.04);
	}

	button.active {
		color: #d93703;
		opacity: 1;
	}

	.locked {
		opacity: 0.4;
		color: #b28b69;
	}

	.numeric {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.numeric small {
		color: #6f3b31;
		white-space: nowrap;
	}
</style>
