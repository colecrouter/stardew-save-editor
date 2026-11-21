<script lang="ts">
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyCheckbox from "../../ui/kit/StudyCheckbox.svelte";

	let { onsection }: { onsection: (section: string) => void } = $props();
	// The user decides when a step matches their remembered progress. Keep
	// checkmarks local to this workspace because they are guide state.
	let completed = $state<Record<string, boolean>>({});

	// Each step hands off to the normal editor section so it uses the same
	// validation, farmer selection, and history as an ordinary edit.
	const steps = [
		{
			section: "calendar",
			label: "Date and weather",
			detail: "Set the calendar date you remember.",
		},
		{
			section: "character",
			label: "Character",
			detail: "Set money, skills, and professions.",
		},
		{
			section: "inventory",
			label: "Inventory",
			detail: "Add items to the selected farmer’s backpack.",
		},
		{
			section: "relationships",
			label: "Relationships",
			detail: "Enter remembered friendship levels.",
		},
		{
			section: "community",
			label: "Community Center & Joja",
			detail: "Restore known bundle or project progress.",
		},
		{
			section: "recipes",
			label: "Recipes",
			detail: "Restore recipe knowledge and production counts.",
		},
		{
			section: "progress",
			label: "Progress",
			detail: "Enter crop shipment counts and check completion requirements.",
		},
		{
			section: "review",
			label: "Review changes",
			detail: "Check the pending edits, then use Export save.",
		},
	];
</script>

<h1>Reconstruct a farm</h1>

<StudyAside title="Start with a valid save">
	<p>
		Create a new farm in Stardew Valley, save it, and keep a separate copy of
		its save folder. Open the new farm’s main save in the editor and use the
		details you remember to rebuild progress.
	</p>

	<p>
		The guide uses your current open save. Old layouts, quest history, and
		platform awards require their own records.
	</p>
</StudyAside>

<ol>
	{#each steps as step (step.section)}
		<li>
			<p>{step.detail}</p>

			<div class="step-actions">
				<StudyButton onclick={() => onsection(step.section)}>
					{step.label}
				</StudyButton>

				<StudyCheckbox
					label="Done"
					aria-label={`Mark ${step.label} done`}
					checked={completed[step.section] ?? false}
					onchange={(event) => {
						completed[step.section] = event.currentTarget.checked;
					}}
				/>
			</div>
		</li>
	{/each}
</ol>

<style>
	li {
		margin-block: 12px;
	}

	li p {
		margin-block: 4px;
	}

	.step-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}
</style>
