<script lang="ts">
	import {
		BABY_QUESTION_CHANCE,
		type BabyQuestionStatus,
	} from "$lib/babyQuestion";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		status: BabyQuestionStatus;
		/** Lets the couple be made pregnant, for players married to each other */
		pregnancy?: {
			pregnant: boolean;
			/** Days until the baby is born, while pregnant */
			daysUntilBirth: number | null;
			onchange: (pregnant: boolean, days?: number) => void;
		};
	}

	let { status, pregnancy }: Props = $props();
	const unmet = $derived(status.requirements.filter((r) => !r.met).length);
</script>

<UiContainerSmall data-testid="baby-question">
	<div class="panel">
		<strong data-testid="baby-question-title">{status.title}</strong>
		<ul>
			{#each status.requirements as requirement (requirement.id)}
				<li>
					<label title={requirement.detail}>
						<UiCheckbox
							checked={requirement.met}
							disabled
							aria-label={requirement.label}
							data-testid={`baby-requirement-${requirement.id}`}
						/>
						<span>{requirement.label}</span>
						<small>{requirement.detail}</small>
					</label>
				</li>
			{/each}
		</ul>
		<p
			class="result"
			class:eligible={status.eligible}
			data-testid="baby-question-status"
		>
			{#if status.eligible}
				Eligible: each night they sleep at home, there's about a {Math.round(
					BABY_QUESTION_CHANCE * 100,
				)}% chance the question comes up.
			{:else}
				Not eligible: {unmet} requirement{unmet === 1 ? "" : "s"} not met.
			{/if}
		</p>
		{#if status.note}
			<small class="note">{status.note}</small>
		{/if}
		{#if pregnancy}
			<label
				class="pregnancy"
				title="Makes the couple expect a baby, skipping the question. It arrives overnight on the due date if a home has the nursery and room for a child."
			>
				<input
					type="checkbox"
					checked={pregnancy.pregnant}
					onchange={(e) => pregnancy.onchange(e.currentTarget.checked)}
					data-testid="baby-player-pregnant"
				/>
				🤰 Expecting a baby
				{#if pregnancy.pregnant}
					<UiInput
						type="number"
						min="1"
						bind:value={() => pregnancy.daysUntilBirth ?? 0,
						(v) => {
							if (v === null) return;
							pregnancy.onchange(true, Number(v));
						}}
						aria-label="Days until the baby is born"
						data-testid="baby-player-days-until-birth"
					/>
					<small>days until birth</small>
				{/if}
			</label>
		{/if}
	</div>
</UiContainerSmall>

<style>
	.panel {
		padding: 8px 10px;
		display: grid;
		gap: 4px;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	label {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	label small {
		margin-left: auto;
		font-size: 0.75em;
		opacity: 0.8;
	}

	/* A disabled checkbox that's met shows a check; the game-style box has none of its own */
	label :global(input:checked) {
		background-color: #7cc576;
	}

	label :global(input:checked)::after {
		content: "✓";
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #2b5a28;
		font-weight: bold;
		line-height: 1;
	}

	label :global(input:disabled) {
		cursor: default;
		filter: none;
	}

	.result {
		margin: 4px 0 0;
		font-weight: bold;
		color: #8a2b1f;
	}

	.pregnancy {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
	}

	.pregnancy :global(input[type="number"]) {
		width: 3em;
	}

	.note {
		opacity: 0.8;
	}

	.result.eligible {
		color: #2b5a28;
	}
</style>
