<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createCharacterDomain } from "../character-domain.ts";
	import CharacterDetails from "./CharacterDetails.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";
	import AppearancePreview from "./AppearancePreview.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selectedFarmer = useAtomValue(
		() => model.atomBindings.selectedFarmerId,
	);
	const characters = $derived(view.current?.characters ?? []);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.farmerChoices ?? [],
			selectedFarmer.current,
			model,
		),
	);
	const preview = $derived(
		view.current?.appearances.find(
			(owner) => owner.farmerId === selectedFarmer.current,
		)?.preview,
	);
	const selected = $derived(
		characters.find(
			(character) => character.farmerId === selectedFarmer.current,
		),
	);
	// The screen receives editor-owned conveniences and captured field operations.
	// Raw save representations and coordinated writes stay in the domain adapter.
	const character = $derived(
		selected ? createCharacterDomain(selected, model) : undefined,
	);
</script>

<div class="character-heading">
	<h1>Character</h1>

	<FarmerSelector field={farmerField} />
</div>

{#if !character || !character.supported}
	<StudyAlert title="Character unavailable" tone="warning">
		<p>{character?.reason ?? "No supported farmer is available."}</p>
	</StudyAlert>
{:else}
	<div class="profile">
		{#if preview}
			<div class="portrait"><AppearancePreview {preview} compact /></div>
		{/if}

		<div>
			<h2 data-sentry-mask="">{character.name}</h2>
			<p class="intro">Skills, professions and life on the farm.</p>
			<div class="skill-levels" role="group" aria-label="Skill levels">
				{#each character.skills as skill (skill.key)}
					<div>
						<span>{skill.label}</span>
						<strong>
							{skill.level ?? "—"}
							<small>/ 10</small>
						</strong>
					</div>
				{/each}
			</div>
		</div>
	</div>

	{#key character.farmerId}
		<CharacterDetails
			details={character.details}
			farmerId={character.farmerId}
			{model}
		/>

		<h2 class="skills-heading">Skills &amp; professions</h2>

		<div class="skills">
			{#each character.skills as skill (skill.key)}
				<section class="skill" aria-label={`${skill.label} skill`}>
					<div class="skill-summary">
						<h2>{skill.label}</h2>
						<!-- The ten blocks echo the game's skill ledger. Exact XP and
						     levels remain editable through the existing field adapters. -->
						<div
							class="level-blocks"
							role="img"
							aria-label={`${skill.label} level ${skill.level ?? "unavailable"} of 10`}
						>
							{#each Array.from({ length: 10 }, (_, index) => index) as index (index)}
								<span
									class:filled={skill.level !== undefined &&
										index < skill.level}
								></span>
							{/each}
						</div>

						{#if skill.supported}
							<div class="experience">
								<NumberField field={skill.fields.xp} />

								<NumberField field={skill.fields.level} />
							</div>
						{:else}
							<p role="status">{skill.reason}</p>
						{/if}
					</div>

					{#if character.professions.supported}
						<div class="branches" aria-label={`${skill.label} professions`}>
							{#each skill.professionBranches as branch (branch.primary.id)}
								<div class="branch">
									<p class="branch-level">Level 5</p>
									<CheckboxField
										field={branch.primary.field}
										description={branch.primary.description}
									/>

									<div class="secondaries">
										<p class="branch-level">Level 10</p>
										{#each branch.secondary as secondary (secondary.id)}
											<CheckboxField
												field={secondary.field}
												description={secondary.description}
											/>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>

		{#if !character.professions.supported}
			<p role="status">{character.professions.reason}</p>
		{/if}

		<section class="mastery" aria-label="Mastery">
			<div>
				<h2>Mastery</h2>
				<p class="mastery-level">Level {character.mastery.level ?? "—"} / 5</p>
				<p class="hint">
					Mastery XP is earned after every skill reaches level 10. Claims are
					made in the Mastery Cave.
				</p>
			</div>

			<div>
				{#if character.mastery.supported}
					<NumberField field={character.fields.masteryXp} />

					<p class="hint">
						{character.mastery.spent} claimed. {character.mastery.minXp
							? `Keep at least ${character.mastery.minXp.toLocaleString("en-US")} XP for existing claims.`
							: "No mastery claims recorded."}
					</p>
				{:else}
					<p role="status">{character.mastery.reason}</p>
				{/if}
			</div>
		</section>
	{/key}
{/if}

<style>
	.profile {
		display: grid;
		grid-template-columns: 180px minmax(0, 1fr);
		gap: 26px;
		align-items: center;
		margin: 24px 0;
		background: #f5dbab;
		border: 2px solid #b98b52;
		padding: 20px;
	}
	.profile > div {
		min-width: 0;
	}
	.profile h2 {
		font-size: 30px;
		overflow-wrap: anywhere;
	}
	.portrait {
		max-width: 180px;
	}
	.skill-levels {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 12px;
	}
	.skill-levels > div {
		display: grid;
		gap: 8px;
	}
	.skill-levels span {
		font-size: 17px;
		color: #694621;
	}
	.skill-levels strong {
		font-size: 25px;
	}
	.skill-levels small {
		font-size: 16px;
		color: #795a36;
		font-weight: 400;
	}
	.skills-heading {
		margin-top: 30px;
	}
	.skills {
		display: grid;
		gap: 18px;
	}
	.level-blocks {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 4px;
		max-width: 230px;
		margin-bottom: 18px;
	}
	.level-blocks span {
		height: 15px;
		border: 1px solid #ac8352;
		background: #e7d0a6;
	}
	.level-blocks span.filled {
		background: #b87035;
		border-color: #84502a;
		box-shadow: inset 0 2px #efb45d;
	}
	.branch-level {
		font-size: 16px;
		color: #795a36;
		margin: 0 0 10px;
	}
	.character-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
	}
	h1 {
		margin: 0;
	}
	h2 {
		font-size: 24px;
		margin: 0 0 12px;
	}
	.intro {
		color: #694621;
		max-width: 65ch;
		margin: 8px 0 20px;
	}
	.skill {
		display: grid;
		grid-template-columns: minmax(170px, 0.8fr) minmax(0, 2fr);
		gap: 28px;
		padding: 22px;
		border: 2px solid #b98b52;
		background: #fff1d2;
	}
	.experience {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 12px;
	}
	.branches {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px;
	}
	.branch {
		min-width: 0;
		border-left: 2px solid #c29b68;
		padding-left: 14px;
	}
	.secondaries {
		display: grid;
		gap: 9px;
		margin: 10px 0 0 14px;
		padding-left: 12px;
		border-left: 1px solid #bb925e;
	}
	.mastery {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 0.75fr);
		gap: 32px;
		border: 2px solid #b98b52;
		background: #f5dbab;
		padding: 22px;
		margin-top: 24px;
	}
	.mastery-level {
		margin: 0 0 8px;
	}
	.hint {
		font-size: 17px;
		color: #694621;
		line-height: 1.3;
		margin: 10px 0 0;
		max-width: 55ch;
	}
	@media (max-width: 1100px) {
		.skill-levels {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.skill {
			grid-template-columns: minmax(0, 1fr);
			gap: 18px;
		}
		.experience {
			max-width: 380px;
		}
	}
	@media (max-width: 600px) {
		.profile {
			grid-template-columns: minmax(0, 1fr);
			padding: 16px;
			gap: 18px;
		}
		.portrait {
			width: 100%;
			margin-inline: auto;
		}
		.skill-levels {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.skill {
			padding: 16px;
		}
		.branches {
			grid-template-columns: minmax(0, 1fr);
		}

		.character-heading {
			flex-wrap: wrap;
		}
		.intro {
			margin-bottom: 20px;
		}
		.branches {
			gap: 14px;
		}
		.secondaries {
			margin-left: 0;
			padding-left: 8px;
		}
		.mastery {
			grid-template-columns: minmax(0, 1fr);
			gap: 18px;
		}
	}
</style>
