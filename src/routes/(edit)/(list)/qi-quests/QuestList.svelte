<script lang="ts">
	import qiQuests from "$generated/qiquests.json";
	import {
		MAX_AVAILABLE_ORDERS,
		type QiQuests,
	} from "$lib/proxies/QiQuests.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		quests: QiQuests;
	}

	let { quests = $bindable() }: Props = $props();

	const MAX_AVAILABLE = MAX_AVAILABLE_ORDERS;

	let filter = $state("");
	let regex = $derived.by(() => searchRegexp(filter));
	let atLimit = $derived(quests.size >= MAX_AVAILABLE);
	let inProgress = $derived(new Set(quests.inProgress));

	function searchRegexp(term: string) {
		try {
			return new RegExp(term, "i");
		} catch {
			console.warn("Invalid regex:", term);
			return /$^/; // Matches nothing
		}
	}
</script>

<UiContainer>
	<h3>Qi's Quests</h3>
	<p class="hint">
		The Walnut Room board only ever offers {MAX_AVAILABLE} at a time - select up
		to {MAX_AVAILABLE} ({quests.size}/{MAX_AVAILABLE} selected).
	</p>

	<div class="search">
		<UiInput type="text" placeholder="Search..." bind:value={filter} />
	</div>

	<div class="wrapper">
		{#each qiQuests as quest}
			{#if regex.test(quest.name)}
				{@const active = inProgress.has(quest.questKey)}
				{@const selected = active || quests.has(quest.questKey)}
				<label class="entry">
					<div class="key" class:disabled={!selected && atLimit}>
						<div class="text">
							<span class="name">
								{quest.name}
								{#if active}
									<span class="tag">In Progress</span>
								{/if}
							</span>
							<span class="description">{quest.description}</span>
						</div>
					</div>

					<div class="actions">
						{#if active}
							<button
								type="button"
								class="cancel"
								data-testid="qi-quest-cancel-{quest.questKey.toLowerCase()}"
								onclick={() => quests.removeInProgress(quest.questKey)}
							>
								Cancel
							</button>
						{:else}
							<button
								type="button"
								class="accept"
								data-testid="qi-quest-accept-{quest.questKey.toLowerCase()}"
								onclick={() => quests.accept(quest.questKey)}
							>
								Make Active
							</button>
						{/if}

						<UiCheckbox
							class="checkbox"
							data-testid="qi-quest-{quest.questKey.toLowerCase()}"
							checked={selected}
							disabled={active || (!selected && atLimit)}
							onchange={() => {
								if (selected) {
									quests.delete(quest.questKey);
								} else if (!atLimit) {
									quests.add(quest.questKey);
								}
							}}
						/>
					</div>
				</label>
			{/if}
		{/each}
	</div>
</UiContainer>

<style>
	.hint {
		margin: 0 4px 8px;
		font-size: 0.85em;
		opacity: 0.85;
	}

	.key.disabled {
		opacity: 0.5;
	}

	:global(.checkbox:disabled) {
		cursor: not-allowed;
	}

	.search :global(input) {
		width: 100%;
		margin: 4px;
		margin-bottom: 8px;
		font-size: large;
	}

	.wrapper {
		display: flex;
		flex-direction: column;
		height: 20rem;
		overflow-y: scroll;
	}

	.entry {
		display: flex;
		justify-content: space-between;
		/* Rows wrap to different heights depending on description length, so
		   align to the top instead of centering - otherwise checkboxes bob up
		   and down relative to a straight column. */
		align-items: flex-start;
		gap: 8px;
		border-bottom: #5b2b2a 1px solid;
		padding: 4px 0.5em;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.actions :global(.checkbox) {
		margin-top: 0.15rem;
	}

	.key {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.text {
		display: flex;
		flex-direction: column;
	}

	.name {
		font-weight: bold;
	}

	.tag {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid #5b2b2a;
		background-color: #f9bb65;
		font-size: 0.7em;
		font-weight: normal;
		vertical-align: middle;
	}

	.cancel,
	.accept {
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid #5b2b2a;
		background: none;
		color: inherit;
		font-family: inherit;
		font-size: 0.7em;
		font-weight: normal;
		white-space: nowrap;
		cursor: pointer;
	}

	.cancel:hover,
	.accept:hover {
		background-color: #5b2b2a;
		color: #f9bb65;
	}

	.description {
		font-size: 0.85em;
		opacity: 0.85;
	}
</style>
