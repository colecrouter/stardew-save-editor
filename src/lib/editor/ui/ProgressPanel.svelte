<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import type { ProgressSection } from "../progress-data.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import StudyTabs from "../../ui/kit/StudyTabs.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
	let {
		model,
		onsection,
	}: { model: EditorModel; onsection: (section: ProgressSection) => void } =
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
	const progress = $derived(view.current?.progress);
	const selected = $derived(
		progress?.farmers.find((farmer) => farmer.farmerId === selection.current),
	);
	const categories = $derived([
		...(selected?.categories ?? []),
		...(progress?.shared ?? []),
	]);
	let tab = $state("perfection");
	let search = $state("");
	let filter = $state("all");
	const awards = $derived(
		(selected?.achievements ?? []).filter(
			(award) =>
				`${award.name} ${award.description}`
					.toLowerCase()
					.includes(search.trim().toLowerCase()) &&
				(filter === "all" ||
					(filter === "recorded"
						? award.recorded === true
						: award.recorded !== true)),
		),
	);
	// Round downward so a near-complete score cannot display as 100%. Bounds
	// remain distinct when uncertainty exists even if their formatted text matches.
	const percent = (value: number) =>
		(Math.floor(value * 100) / 100).toLocaleString(undefined, {
			maximumFractionDigits: 2,
		});
</script>

<div class="heading">
	<h1>Progress</h1>

	<FarmerSelector field={farmerField} />
</div>

<StudyTabs
	label="Progress views"
	bind:value={tab}
	items={[
		{ value: "perfection", label: "Perfection", content: perfection },
		{ value: "achievements", label: "Achievements", content: achievements },
	]}
/>

{#snippet perfection()}
	{#if progress}
		<section aria-label="Farm Perfection score" class="score">
			<h2>Farm Perfection</h2>

			{#if progress.lower === progress.upper}
				<p class="total">{percent(progress.lower)}%</p>
			{:else}
				<p class="total">
					{percent(progress.lower)}%–{percent(progress.upper)}%
				</p>

				<p>The exact score cannot be determined from some saved fields.</p>
			{/if}

			<p>Perfection waivers: {progress.waivers ?? "Unable to determine"}</p>

			<details>
				<summary>How the farm score is calculated</summary>

				<p>
					Each category uses the best result from one customized farmer. Partial
					lists are not combined across players. Buildings and Golden Walnuts
					found are shared. Each waiver adds one percentage point, up to 100%.
				</p>

				<ul>
					{#each progress.leaders as leader (leader.category.id)}
						<li>
							{leader.category.label}: {percent(
								leader.category.lower * leader.category.weight,
							)} / {leader.category.weight} percentage points — {leader.farmer}{leader
								.category.lower !== leader.category.upper
								? " (uncertain)"
								: ""}
						</li>
					{/each}
				</ul>
			</details>
		</section>
	{/if}

	<h2>Requirements for {selected?.name ?? "the selected farmer"}</h2>

	<details>
		<summary>About completion credit</summary>

		<p>
			Cooking requires a learned recipe and a recorded cooking entry, even when
			its count is zero. Crafting requires a positive count; the Wedding Ring is
			excluded. Friendship uses eight hearts for romanceable villagers and ten
			for other required villagers, excluding children. Stardrops and Monster
			Slayer Hero award their Perfection contribution only when the full
			category is complete.
		</p>

		<p>
			These diagnostics use vanilla game requirements. Mod-added requirements
			and runtime conditions are not evaluated. Reading progress does not grant
			rewards or trigger endgame events.
		</p>
	</details>

	{#each categories as category (category.id)}
		<section aria-label={`${category.label} requirements`}>
			<h3>
				{category.label}{["obelisks", "clock", "walnuts"].includes(category.id)
					? " (shared)"
					: ""}
			</h3>

			<p>
				{#if category.id === "walnuts"}
					{category.requirements[0]?.value ?? "Unknown"} / 130 found
				{:else}
					{category.completed} / {category.total} complete
				{/if}
				· {category.weight}% of Perfection
			</p>

			{#if category.note}
				<p>{category.note}</p>
			{/if}

			{#if category.unknown}
				<p>
					{category.unknown} requirements cannot be determined from this saved data.
				</p>
			{/if}

			{#if category.id === "skills"}
				<p>
					Farmer level: {category.lower === category.upper
						? `${Math.round(category.lower * 25)} / 25`
						: "Unable to determine"}
				</p>
			{/if}

			<details>
				<summary>Missing or uncertain requirements</summary>

				<ul>
					{#each category.requirements.filter((row) => row.status !== "complete") as row (row.id ?? row.name)}
						<li>
							{row.name} — {row.status === "unknown"
								? "Unable to determine"
								: row.learned === false
									? "Not learned"
									: row.learned === true
										? "Learned; not yet made"
										: `${row.value ?? 0} / ${row.target ?? 1}`}
						</li>
					{:else}
						<li>All requirements complete.</li>
					{/each}
				</ul>
			</details>

			{#if category.section}
				<StudyButton
					onclick={() => category.section && onsection(category.section)}
				>
					Open {category.section}
				</StudyButton>
			{/if}
		</section>
	{/each}
{/snippet}

{#snippet achievements()}
	<p>
		Recorded awards stay earned even if their current requirements change.
		Requirement progress below is evaluated separately; platform unlock status
		is not stored in this save.
	</p>

	<div class="filters">
		<StudyField label="Search achievements">
			{#snippet children(attributes)}
				<input
					{...attributes}
					class="study-input"
					type="search"
					bind:value={search}
				/>
			{/snippet}
		</StudyField>

		<StudyField label="Show achievements">
			{#snippet children(attributes)}
				<select {...attributes} class="study-input" bind:value={filter}>
					<option value="all">All achievements</option>

					<option value="recorded">Recorded in save</option>

					<option value="remaining">Not recorded or uncertain</option>
				</select>
			{/snippet}
		</StudyField>
	</div>

	<p role="status">{awards.length} achievements</p>

	<ul class="awards">
		{#each awards as award (award.id)}
			<li>
				<h3>{award.name}</h3>

				<p>{award.description}</p>

				<p>
					{award.recorded === undefined
						? "Saved award status unavailable"
						: award.recorded
							? "Recorded in save"
							: "Not recorded in save"}
				</p>

				<p>
					{award.value !== undefined && award.target !== undefined
						? `${Math.min(award.value, award.target).toLocaleString()} / ${award.target.toLocaleString()} — `
						: ""}{award.status}
				</p>

				{#if award.evidence}
					<p>{award.evidence}</p>
				{/if}
			</li>
		{:else}
			<li>No achievements match these filters.</li>
		{/each}
	</ul>
{/snippet}

{#if !selected}
	<p>Choose a farmer with available progress data.</p>
{/if}

<StudyButton onclick={() => onsection("recipes")}>Edit recipes</StudyButton>

<style>
	.heading,
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	section {
		margin-block: 1.5rem;
	}
	li {
		margin-block: 0.5rem;
	}
	p {
		max-width: 75ch;
	}
	.total {
		font-size: 2rem;
		margin-block: 0.5rem;
	}
	.awards {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
		gap: 1rem;
	}
	.awards li {
		border: 1px solid var(--study-border, #a67845);
		padding: 1rem;
	}
</style>
