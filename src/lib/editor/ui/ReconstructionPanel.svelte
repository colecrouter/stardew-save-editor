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

<h1>Rebuild lost progress</h1>

<StudyAside title="Lost your farm and starting over?">
	<p>
		If you’ve lost your old save and opened a new farm here, this guide helps
		you get back to where you left off. Start with what matters most to you,
		like the tools you used, the friends you made, or the bundles you finished.
	</p>

	<p>
		Keep a copy of your new farm’s save folder before editing. Each step opens
		the place to make those changes to the farm you have open. Mark steps done
		as you go, skip anything you don’t remember, and review your changes before
		exporting.
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
