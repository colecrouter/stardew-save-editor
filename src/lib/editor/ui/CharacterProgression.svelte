<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import { createCharacterDomain } from "../character-domain.ts";
	import type { EditorModel } from "../editor-model.ts";
	import CharacterDetails from "./CharacterDetails.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import NumberField from "./fields/NumberField.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selectedFarmer = useAtomValue(
		() => model.atomBindings.selectedFarmerId,
	);
	const characters = $derived(view.current?.characters ?? []);
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

{#if !character || !character.supported}
	<StudyAlert title="Character unavailable" tone="warning">
		<p>{character?.reason ?? "No supported farmer is available."}</p>
	</StudyAlert>
{:else}
	<h2 class="farmer-name" data-sentry-mask="">{character.name}</h2>

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
	.farmer-name {
		margin: 0 0 20px;
	}
	.skills-heading {
		margin-top: 30px;
	}
	.skills {
		display: grid;
		gap: 18px;
	}
	.level-blocks {
		/* Preserve the legacy game's red skill pips and wider gold
		   profession milestones. Fixed geometry prevents level edits shifting fields. */
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px;
		margin-bottom: 16px;
	}
	.level-blocks span {
		flex: none;
		box-sizing: content-box;
		width: 6px;
		height: 16px;
		background: #c87c1e;
		border: 2px solid;
		border-radius: 2px;
		border-color: #cb912e;
		box-shadow:
			0 0 0 2px #8c5721,
			inset -2px 2px 0 0 #ad611a;
	}
	.level-blocks span:nth-child(5n) {
		width: 24px;
	}
	.level-blocks span.filled {
		background: #dd003b;
		border-color: #ff6948 #ff6948 #bc004a #bc004a;
		box-shadow: 0 0 0 2px #960027;
	}
	.level-blocks span.filled:nth-child(5n) {
		background: #ffa400;
		border-color: #ffc62e #ffc62e #e06a00 #e06a00;
	}
	.branch-level {
		font-size: 16px;
		color: #795a36;
		margin: 0 0 10px;
	}
	@media (min-width: 1200px) {
		.skills {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.skills .skill {
			grid-template-columns: minmax(0, 1fr);
			gap: 18px;
			padding: 18px;
		}
		.branches {
			gap: 16px;
		}
		.branch {
			padding-left: 10px;
		}
	}
	@media (max-width: 600px) {
		.level-blocks {
			gap: 7px;
		}
	}
	@media (max-width: 380px) {
		.level-blocks {
			gap: 5px;
			padding: 5px;
		}
		.level-blocks span {
			width: 2px;
			height: 12px;
			border-width: 3px;
		}
		.level-blocks span:nth-child(5n) {
			width: 16px;
		}
	}
	h2 {
		font-size: 24px;
		margin: 0 0 12px;
	}
	.skill {
		display: grid;
		grid-template-columns: 280px minmax(0, 1fr);
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
		.skill {
			grid-template-columns: minmax(0, 1fr);
			gap: 18px;
		}
		.experience {
			max-width: 380px;
		}
	}
	@media (max-width: 600px) {
		.skill {
			padding: 16px;
		}
		.branches {
			grid-template-columns: minmax(0, 1fr);
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
