<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";

	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyCheckbox from "../../ui/kit/StudyCheckbox.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
	import StudyTabs from "../../ui/kit/StudyTabs.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	import type { StudyIconName } from "../../ui/studyIcons.ts";
	import { hasOwnKey } from "../../unknown.ts";
	import type { EditorModel } from "../editor-model.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import type { ImmutableView } from "../immutable-view.ts";
	import { readItemVisual } from "../item-presentation.ts";
	import type { ProgressCategory, ProgressSection } from "../progress-data.ts";
	import {
		concealedAchievement,
		presentProgressCategory,
	} from "../progress-spoilers.ts";
	import AchievementIcon from "./AchievementIcon.svelte";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import CollectionPanel from "./CollectionPanel.svelte";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import ProgressMeter from "./ProgressMeter.svelte";

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

	const spoilerPreferenceKey = "stardew-editor:hide-progress-spoilers";
	// Only an explicit opt-out reveals spoilers. Read before creating markup;
	// absent, unrecognised or inaccessible storage keeps the safe default.
	let hideSpoilers = $state(true);
	try {
		hideSpoilers = localStorage.getItem(spoilerPreferenceKey) !== "false";
	} catch {
		// The session can still use its toggle when the preference cannot be read.
	}
	$effect(() => {
		try {
			localStorage.setItem(spoilerPreferenceKey, String(hideSpoilers));
		} catch (e) {
			// Persistence is optional; never interrupt inspection of the save.
			console.warn("Failed to persist spoiler preference.", e);
		}
	});

	let tab = $state("perfection");
	let search = $state("");
	let filter = $state("all");
	// Conceal identities and requirements, not the existence of awards. Placeholder
	// searches and counts intentionally stay available under the Progress policy.
	const awards = $derived(
		(selected?.achievements ?? []).filter(
			(award) =>
				(concealedAchievement(award, hideSpoilers)
					? "Hidden achievement"
					: `${award.name} ${award.description}`
				)
					.toLowerCase()
					.includes(search.trim().toLowerCase()) &&
				(filter === "all" ||
					(filter === "recorded"
						? award.recorded === true
						: award.recorded !== true)),
		),
	);

	const recordedCount = $derived(
		selected?.achievements.every((award) => award.recorded !== undefined)
			? selected.achievements.filter((award) => award.recorded).length
			: undefined,
	);

	const categoryIcons = {
		shipping: "chests",
		fishing: "farm",
		friends: "relationships",
		skills: "character",
		monsters: "events",
		stardrops: "qi",
		cooking: "cooking",
		crafting: "crafting",
		obelisks: "buildings",
		clock: "buildings",
		walnuts: "tree",
	} satisfies Record<string, StudyIconName>;

	// Reuse the game's catalog-backed sprites for categories without a matching
	// section icon. These are drawing instructions, never saved item records.
	const categoryVisuals = {
		fishing: readItemVisual({ $type: "StardewValley.Object", itemId: "145" }),
		monsters: readItemVisual({
			$type: "StardewValley.Tools.MeleeWeapon",
			itemId: "0",
		}),
		stardrops: readItemVisual({ $type: "StardewValley.Object", itemId: "434" }),
		walnuts: readItemVisual({ $type: "StardewValley.Object", itemId: "73" }),
	} satisfies Partial<Record<string, ReturnType<typeof readItemVisual>>>;

	function categoryMeasure(category: ImmutableView<ProgressCategory>) {
		// Keep the checklist's measure honest: skills use Farmer.Level, walnuts
		// use the found counter, and historical Stardrop completion is not seven
		// invented source flags. Other rows show verified requirement membership.
		if (category.id === "skills")
			return {
				value: category.lower * 25,
				possible: category.upper * 25,
				max: 25,
				text:
					category.lower === category.upper
						? `${Math.round(category.lower * 25)} / 25 farmer level`
						: "Farmer level uncertain",
			};
		if (category.id === "walnuts")
			return {
				value: category.requirements[0]?.value ?? 0,
				possible: category.upper * 130,
				max: 130,
				text: `${category.requirements[0]?.value ?? "Unknown"} / 130 found`,
			};
		if (category.id === "stardrops" && category.note && category.lower === 1)
			return { value: 1, possible: 1, max: 1, text: "Completion recorded" };
		return {
			value: category.completed,
			possible: category.completed + category.unknown,
			max: category.total,
			text: `${category.completed} / ${category.total} complete`,
		};
	}
	// Round downward so a near-complete score cannot display as 100%. Bounds
	// remain distinct when uncertainty exists even if their formatted text matches.
	const percent = (value: number) =>
		(Math.floor(value * 100) / 100).toLocaleString(undefined, {
			maximumFractionDigits: 2,
		});
</script>

<div class="heading">
	<div>
		<h1>Progress</h1>
	</div>

	<FarmerSelector field={farmerField} />
</div>

<div class="progress-tabs">
	<StudyTabs
		label="Progress views"
		bind:value={tab}
		items={[
			{ value: "perfection", label: "Perfection", content: perfection },
			{ value: "achievements", label: "Achievements", content: achievements },
			{ value: "shipments", label: "Shipping collection", content: shipments },
			{ value: "fishing", label: "Fishing", content: fishing },
		]}
	/>
</div>

{#snippet shipments()}
	<CollectionPanel
		{model}
		farmer={selected}
		kind="shipping"
	/>
{/snippet}

{#snippet fishing()}
	<CollectionPanel
		{model}
		farmer={selected}
		kind="fishing"
	/>
{/snippet}

{#snippet spoilerToggle()}
	<StudyCheckbox
		label="Hide spoilers"
		bind:checked={hideSpoilers}
	/>
{/snippet}

{#snippet perfection()}
	<div class="perfection-toolbar">
		{@render spoilerToggle()}
	</div>

	{#if progress}
		<section
			aria-label="Farm Perfection score"
			class="score"
		>
			<div class="score-heading">
				<div>
					<h2>Farm Perfection</h2>
				</div>

				<p class="total">
					{percent(progress.lower)}%{progress.lower !== progress.upper
						? `–${percent(progress.upper)}%`
						: ""}
				</p>
			</div>

			<ProgressMeter
				label="Farm Perfection"
				value={progress.lower}
				possible={progress.upper}
				max={100}
				valueText={progress.lower === progress.upper
					? `${percent(progress.lower)}% complete`
					: `${percent(progress.lower)}% to ${percent(progress.upper)}%; some progress is uncertain`}
			/>

			<div class="score-footer">
				<span>
					{hideSpoilers ? "Additional score credit" : "Perfection waivers"}: {progress.waivers ??
						"Unable to determine"}
				</span>

				<span>
					{progress.lower === progress.upper
						? "100% goal"
						: "Hatched progress is uncertain"}
				</span>
			</div>

			<details class="guide">
				<summary>How the farm score is calculated</summary>

				<p>
					Each category uses the best result from one customized farmer. Partial
					lists are not combined across players. Some categories are shared.
					Additional score credit contributes percentage points, up to 100%.
				</p>

				<ul class="contributions">
					{#each progress.leaders as leader (leader.category.id)}
						<li>
							<span>
								{presentProgressCategory(leader.category, hideSpoilers).label} · {leader.farmer ??
									"Shared"}
							</span>

							<span>
								{percent(leader.category.lower * leader.category.weight)} / {leader
									.category.weight} points{leader.category.lower !==
								leader.category.upper
									? " (uncertain)"
									: ""}
							</span>
						</li>
					{/each}
				</ul>
			</details>
		</section>
	{/if}

	<div class="checklist-heading">
		<h2>Requirements for {selected?.name ?? "the selected farmer"}</h2>

		<p class="muted">Open a category to see what remains.</p>
	</div>

	<!-- Native disclosures retain their open state across edits and tab changes.
	     Counts stay in the summary, so the whole checklist can be scanned closed. -->
	<div class="categories">
		{#each categories as originalCategory (originalCategory.id)}
			{@const category = presentProgressCategory(
				originalCategory,
				hideSpoilers,
			)}
			{@const measure = categoryMeasure(category)}
			{@const complete = category.lower === 1 && category.upper === 1}
			{@const concealed = category.label === "Undiscovered milestone"}
			<!-- These maps intentionally cover different subsets of category IDs.
			     Guard each lookup so unknown IDs and concealed milestones use fallbacks. -->
			{@const visual =
				!concealed && hasOwnKey(categoryVisuals, category.id)
					? categoryVisuals[category.id]
					: undefined}
			{@const icon =
				!concealed && hasOwnKey(categoryIcons, category.id)
					? categoryIcons[category.id]
					: "review"}
			<section
				aria-label={`${category.label} requirements`}
				class="category"
				class:complete
			>
				<details>
					<summary class="category-summary">
						<span class="category-icon">
							{#if visual}
								<BackpackItemVisual
									{visual}
									size={30}
								/>
							{:else}
								<StudyIcon
									name={icon}
									size={30}
								/>
							{/if}
						</span>

						<span class="category-content">
							<span
								class="category-title"
								role="heading"
								aria-level="3"
							>
								{category.label}
							</span>

							<span class="category-count">
								{measure.text}{["obelisks", "clock", "walnuts"].includes(
									category.id,
								)
									? " · Shared"
									: ""}
							</span>

							<ProgressMeter
								label={`${category.label} progress`}
								value={measure.value}
								possible={measure.possible}
								max={measure.max}
							/>
						</span>

						<span class="category-weight">
							{#if complete}
								<span class="complete-label">
									<StudyIcon
										name="check"
										size={16}
									/> Complete
								</span>
							{/if}

							<span>{category.weight}% of Perfection</span>
						</span>

						<span
							class="disclosure-arrow"
							aria-hidden="true"
						></span>
					</summary>

					<div class="category-details">
						{#if category.note}
							<p>{category.note}</p>
						{/if}

						{#if category.unknown}
							<p class="uncertain-note">
								{category.unknown} requirements cannot be determined from this saved
								data.
							</p>
						{/if}

						<h4>Missing or uncertain requirements</h4>

						<ul class="requirements">
							{#each category.requirements.filter((row) => row.status !== "complete") as row (row.id ?? row.name)}
								<li>
									<span>{row.name}</span>

									<span class="muted">
										{row.status === "unknown"
											? "Unable to determine"
											: row.learned === false
												? "Not learned"
												: row.learned === true
													? "Learned; not yet made"
													: `${row.value ?? 0} / ${row.target ?? 1}`}
									</span>
								</li>
							{:else}
								<li>All requirements complete.</li>
							{/each}
						</ul>

						{#if category.section}
							<StudyButton
								onclick={() => category.section && onsection(category.section)}
							>
								Open {category.section}
							</StudyButton>
						{/if}
					</div>
				</details>
			</section>
		{/each}
	</div>

	<details class="guide completion-guide">
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
{/snippet}

{#snippet achievements()}
	<div class="achievement-overview">
		{#if recordedCount !== undefined}
			<p>
				<strong>{recordedCount} / {selected?.achievements.length ?? 0}</strong>
				recorded in this save
			</p>

			<ProgressMeter
				label="Recorded achievements"
				value={recordedCount}
				max={selected?.achievements.length ?? 0}
			/>
		{:else}
			<p>Saved award status unavailable</p>
		{/if}

		<details class="guide">
			<summary>About achievement status</summary>

			<p>
				Recorded awards stay earned even if their current requirements change.
				Requirement progress below is evaluated separately; platform unlock
				status is not stored in this save.
			</p>
		</details>
	</div>

	<div class="filters">
		<StudyField label="Search achievements">
			{#snippet children(attributes)}
				<input
					{...attributes}
					class="study-input"
					type="search"
					placeholder="Name or requirement"
					bind:value={search}
				/>
			{/snippet}
		</StudyField>

		<StudyField label="Show achievements">
			{#snippet children(attributes)}
				<select
					{...attributes}
					class="study-input"
					bind:value={filter}
				>
					<option value="all">All achievements</option>

					<option value="recorded">Recorded in save</option>

					<option value="remaining">Not recorded or uncertain</option>
				</select>
			{/snippet}
		</StudyField>

		<div class="spoiler-toggle">
			{@render spoilerToggle()}
		</div>
	</div>

	<p
		class="result-count"
		role="status"
	>
		{awards.length}
		{awards.length === 1 ? "achievement" : "achievements"}
	</p>

	<ul class="awards">
		{#each awards as award (award.id)}
			{@const concealed = concealedAchievement(award, hideSpoilers)}
			<li class:earned={award.recorded === true}>
				<span
					class="award-mark"
					class:marked={award.recorded === true}
					aria-hidden="true"
				>
					<AchievementIcon
						id={award.id}
						recorded={award.recorded}
						{concealed}
					/>
				</span>

				<div class="award-content">
					<div class="award-heading">
						<h3>{concealed ? "Hidden achievement" : award.name}</h3>

						<p class="award-record">
							{award.recorded === undefined
								? "Saved award status unavailable"
								: award.recorded
									? "Recorded in save"
									: "Not recorded in save"}
						</p>
					</div>

					{#if concealed}
						<p class="award-description">
							Record this award in the save, or turn off Hide spoilers to reveal
							its details.
						</p>
					{:else}
						<p class="award-description">{award.description}</p>

						<!-- Unknown requirements have no fabricated filled bar. The explicit
					     status remains distinct from the saved award shown above. -->
						{#if award.value !== undefined && award.target !== undefined && award.status !== "Unable to determine"}
							<ProgressMeter
								label={`${award.name} requirements`}
								value={award.value}
								max={award.target}
							/>
						{/if}

						<p
							class="award-progress"
							class:uncertain={award.status === "Unable to determine"}
						>
							{award.value !== undefined && award.target !== undefined
								? `${Math.min(award.value, award.target).toLocaleString()} / ${award.target.toLocaleString()} — `
								: ""}{award.status}
						</p>

						{#if award.evidence}
							<details class="guide evidence">
								<summary>How this is checked</summary>

								<p>{award.evidence}</p>
							</details>
						{/if}
					{/if}
				</div>
			</li>
		{:else}
			<li class="empty-result">
				<StudyIcon
					name="review"
					size={32}
				/>

				<div>
					<h3>No achievements match these filters.</h3>

					<p class="muted">Try another name or show all achievements.</p>
				</div>
			</li>
		{/each}
	</ul>
{/snippet}

{#if !selected}
	<p>Choose a farmer with available progress data.</p>
{/if}

<div class="recipe-link">
	<span class="muted">
		Cooking and crafting progress can be changed in Recipes.
	</span>

	<StudyButton onclick={() => onsection("recipes")}>Edit recipes</StudyButton>
</div>

<style>
	/* Perfection has no search filters; keep the same preference reachable in
	   a compact toolbar rather than reserving a page-wide explanatory block. */
	.perfection-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-top: 1rem;
	}
	.spoiler-toggle {
		display: flex;
		align-items: center;
		min-height: 44px;
	}
	.heading,
	.score-heading,
	.score-footer,
	.award-heading,
	.recipe-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.heading {
		margin-bottom: 1.25rem;
	}
	h1,
	h2,
	h3,
	h4,
	p {
		margin: 0;
	}
	h2 {
		font-size: 26px;
	}
	h3,
	.category-title {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 21px;
		line-height: 1.2;
	}
	h4 {
		font: inherit;
		margin-block: 0.75rem;
	}
	p {
		overflow-wrap: anywhere;
	}
	.muted,
	.category-count,
	.category-weight,
	.result-count {
		color: var(--study-muted);
	}
	.score {
		margin-block: 1.5rem 2rem;
		padding: 1.25rem;
		background: var(--study-paper-light);
		border: 2px solid var(--study-rule);
	}
	.score-heading {
		margin-bottom: 1rem;
	}
	.total {
		font-family: "Pixelify Sans", sans-serif;
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.score-footer {
		font-size: 18px;
		margin-block: 0.6rem 1rem;
	}
	.guide {
		color: var(--study-muted);
		font-size: 18px;
	}
	.guide summary {
		cursor: pointer;
		width: fit-content;
		min-height: 32px;
		padding-block: 4px;
	}
	.guide p {
		max-width: 75ch;
		margin-block: 0.5rem;
	}
	.guide summary:focus-visible,
	.category-summary:focus-visible {
		outline: 3px solid var(--study-focus);
		outline-offset: 3px;
	}
	.contributions {
		padding: 0;
		list-style: none;
	}
	.contributions li {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		column-gap: 1rem;
		padding-block: 0.3rem;
		border-bottom: 1px solid var(--study-rule);
	}
	.checklist-heading {
		margin-bottom: 1rem;
	}
	.checklist-heading .muted {
		margin-top: 0.35rem;
	}
	.categories {
		border-top: 1px solid var(--study-rule);
	}
	.category {
		border-bottom: 1px solid var(--study-rule);
	}
	.category-summary {
		padding: 1rem 0.25rem;
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) auto 16px;
		align-items: center;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
	}
	.category-summary::-webkit-details-marker {
		display: none;
	}
	.category-summary:hover {
		background: #fff2d340;
	}
	.category-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.category-content {
		display: grid;
		gap: 0.4rem;
		min-width: 0;
	}
	.category-title {
		color: var(--study-ink);
	}
	.category-count {
		font-size: 18px;
		font-variant-numeric: tabular-nums;
	}
	.category-weight {
		display: grid;
		gap: 0.35rem;
		text-align: right;
		font-size: 18px;
	}
	.complete-label {
		color: var(--study-success);
	}
	.disclosure-arrow {
		width: 0;
		height: 0;
		border-block: 5px solid transparent;
		border-left: 6px solid var(--study-muted);
		margin-inline: auto;
	}
	.category details[open] > summary .disclosure-arrow {
		transform: rotate(90deg);
	}
	.category-details {
		padding: 0 2rem 1.25rem 3.5rem;
	}
	.category-details > p {
		margin-block: 0.75rem;
	}
	.uncertain-note,
	.uncertain {
		color: var(--study-warning);
	}
	.requirements {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 1.5rem;
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
	}
	.requirements li {
		display: grid;
		gap: 0.1rem;
		padding-block: 0.55rem;
		border-bottom: 1px solid #b98b5250;
		overflow-wrap: anywhere;
	}
	.requirements .muted {
		font-size: 18px;
	}
	.completion-guide {
		margin-block: 1rem 1.5rem;
	}
	.achievement-overview {
		padding-block: 1.5rem;
		display: grid;
		gap: 0.75rem;
		max-width: 36rem;
	}
	.achievement-overview strong {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 1.5rem;
	}
	.filters {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem) auto;
		gap: 1rem;
		align-items: end;
	}
	.result-count {
		margin-block: 0.75rem;
		font-size: 18px;
	}
	.awards {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 1px solid var(--study-rule);
	}
	.awards > li {
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr);
		gap: 1rem;
		padding: 1.25rem 0.25rem;
		border-bottom: 1px solid var(--study-rule);
	}
	.award-mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		color: var(--study-muted);
	}
	.award-mark.marked {
		color: var(--study-success);
	}
	.award-content {
		min-width: 0;
	}
	.award-heading {
		gap: 0.35rem 1rem;
		align-items: baseline;
	}
	.award-record {
		color: var(--study-muted);
		font-size: 18px;
	}
	.earned .award-record {
		color: var(--study-success);
	}
	.award-description {
		color: var(--study-muted);
		margin-block: 0.4rem 0.75rem;
	}
	.award-progress {
		margin-top: 0.4rem;
		font-size: 18px;
	}
	.evidence {
		margin-top: 0.35rem;
	}
	.recipe-link {
		border-top: 2px solid var(--study-rule);
		margin-top: 1.5rem;
		padding-top: 1rem;
		font-size: 18px;
	}
	@media (min-width: 651px) and (max-width: 1100px) {
		/* Let search retain useful width between the mobile and wide layouts. */
		.filters {
			grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem);
		}
		.spoiler-toggle {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 650px) {
		.score {
			padding: 1rem;
		}
		.score-footer {
			gap: 0.3rem;
		}
		.category-summary {
			grid-template-columns: 28px minmax(0, 1fr) 14px;
			gap: 0.65rem;
		}
		.category-weight {
			grid-column: 2;
			text-align: left;
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
		}
		.disclosure-arrow {
			grid-column: 3;
			grid-row: 1 / 3;
		}
		.category-details {
			padding: 0 0.5rem 1rem 2.5rem;
		}
		.requirements {
			grid-template-columns: 1fr;
		}
		.filters {
			grid-template-columns: 1fr;
		}
		.awards > li {
			gap: 0.75rem;
		}
		.award-heading {
			display: grid;
		}
	}
	@media (max-width: 380px) {
		/* Wrap whole tabs on narrow phones so their names and touch targets
		   remain intact when the three labels outgrow one row. */
		.progress-tabs :global(.study-tabs-list) {
			flex-wrap: wrap;
			gap: 2px;
			padding-inline: 0;
		}
		.progress-tabs :global(.study-tab) {
			flex: 1 1 auto;
			min-width: 0;
			padding-inline: 4px;
			font-size: 20px;
		}
	}
</style>
