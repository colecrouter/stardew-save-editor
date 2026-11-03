<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import StudyTabs from "../../ui/kit/StudyTabs.svelte";
	import AppearancePanel from "./AppearancePanel.svelte";
	import CharacterProgression from "./CharacterProgression.svelte";
	let { model, oninventory }: { model: EditorModel; oninventory: () => void } =
		$props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.farmerChoices ?? [],
			selection.current,
			model,
		),
	);
	let tab = $state("profile");
	let progressionOpened = $state(false);
	function selectTab(value: string) {
		// Retained tab panels do not unmount their inputs. Finish the old gesture
		// explicitly before hiding it, including programmatic/keyboard tab changes.
		void model.edits.endActive();
		tab = value;
		if (value === "progression") progressionOpened = true;
	}
</script>

<header>
	<h1>Character</h1>

	<FarmerSelector field={farmerField} />
</header>

{#snippet profile()}
	<AppearancePanel {model} {oninventory} />
{/snippet}

{#snippet progression()}
	<!-- Avoid progression subscriptions until first visit; retain them afterwards
	     so hiding a tab preserves local inputs and farmer-scoped ownership. -->
	{#if progressionOpened}
		<CharacterProgression {model} />
	{/if}
{/snippet}

<!-- Both labels stay visible on phones rather than requiring a horizontal swipe. -->
<div class="character-views">
	<StudyTabs
		label="Character views"
		bind:value={() => tab, selectTab}
		items={[
			{ value: "profile", label: "Profile & appearance", content: profile },
			{
				value: "progression",
				label: "Skills & progression",
				content: progression,
			},
		]}
	/>
</div>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 20px;
	}
	h1 {
		margin: 0;
		font-size: 32px;
	}
	@media (max-width: 600px) {
		.character-views :global(.study-tab) {
			flex: 1 1 0;
			min-width: 0;
			white-space: normal;
			padding: 8px 6px;
			font-size: 17px;
		}
		h1 {
			font-size: 28px;
		}
	}
</style>
