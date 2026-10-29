<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createCharacterDomain } from "../character-domain.ts";
	import NumberField from "./fields/NumberField.svelte";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import FarmerSelector from "./fields/FarmerSelector.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selectedFarmer = useAtomValue(
		() => model.atomBindings.selectedFarmerId,
	);
	const characters = $derived(view.current?.characters ?? []);
	const farmerField = $derived(
		createFarmerSelectionField(characters, selectedFarmer.current, model),
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
	<p role="status">
		{character?.reason ?? "No supported farmer is available."}
	</p>
{:else}
	<p class="intro">
		Edit experience and professions for {character.name}. Changes update
		immediately; use Undo to revert.
	</p>

	{#key character.farmerId}
		<div class="skills">
			{#each character.skills as skill (skill.key)}
				<section class="skill" aria-label={`${skill.label} skill`}>
					<div class="skill-summary">
						<h2>{skill.label}</h2>

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
									<CheckboxField
										field={branch.primary.field}
										description={branch.primary.description}
									/>

									<div class="secondaries">
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
		margin: 12px 0 24px;
	}
	.skill {
		display: grid;
		grid-template-columns: minmax(170px, 0.8fr) minmax(0, 2fr);
		gap: 28px;
		padding: 22px 0;
		border-top: 1px solid #bb925e;
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
		border-top: 1px solid #bb925e;
		padding: 24px 0 0;
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
