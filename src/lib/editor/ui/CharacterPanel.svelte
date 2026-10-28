<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { professionDefinitions } from "../character-data.ts";
	import { setCharacter } from "../character-operations.ts";
	import CharacterNumberField from "./CharacterNumberField.svelte";
	import CharacterProfession from "./CharacterProfession.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const characters = $derived(view.current?.characters ?? []);
	let farmerIndex = $state(0);
	const character = $derived(characters[farmerIndex]);
</script>

<div class="character-heading">
	<h1>Character</h1>

	{#if characters.length > 1}
		<label class="farmer">
			Farmer
			<select bind:value={farmerIndex}>
				{#each characters as farmer, index (index)}
					<option value={index}>{farmer.name}</option>
				{/each}
			</select>
		</label>
	{/if}
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
								<CharacterNumberField
									label={`${skill.label} XP`}
									value={skill.xp}
									max={99999}
									onchange={(value) =>
										model.commands.transact(
											setCharacter({
												farmerId: character.farmerId,
												kind: "skill-xp",
												skill: skill.key,
												value,
											}),
										)}
								/>

								<CharacterNumberField
									label={`${skill.label} level`}
									value={skill.level}
									max={10}
									onchange={(value) =>
										model.commands.transact(
											setCharacter({
												farmerId: character.farmerId,
												kind: "skill-level",
												skill: skill.key,
												value,
											}),
										)}
								/>
							</div>
						{:else}
							<p role="status">{skill.reason}</p>
						{/if}
					</div>

					{#if character.professions.supported}
						<div class="branches" aria-label={`${skill.label} professions`}>
							{#each professionDefinitions.filter((profession) => profession.skill === skill.key && profession.parent === undefined) as primary (primary.id)}
								<div class="branch">
									<CharacterProfession
										{model}
										farmerId={character.farmerId}
										profession={primary}
										checked={character.professions.values.includes(primary.id)}
										description={primary.description}
									/>

									<div class="secondaries">
										{#each professionDefinitions.filter((profession) => profession.parent === primary.id) as secondary (secondary.id)}
											<CharacterProfession
												{model}
												farmerId={character.farmerId}
												profession={secondary}
												checked={character.professions.values.includes(
													secondary.id,
												)}
												disabled={!character.professions.values.includes(
													primary.id,
												) &&
													!character.professions.values.includes(secondary.id)}
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
					<CharacterNumberField
						label="Mastery XP"
						value={character.mastery.xp}
						min={character.mastery.minXp}
						max={2147483647}
						onchange={(value) =>
							model.commands.transact(
								setCharacter({
									farmerId: character.farmerId,
									kind: "mastery-xp",
									value,
								}),
							)}
					/>

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
	.farmer {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	select {
		min-height: 40px;
		max-width: 220px;
		font: inherit;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		padding: 4px 8px;
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
