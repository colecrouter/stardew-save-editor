<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createPetFields } from "../pet-domain.ts";
	import StudyPanel from "../../ui/kit/StudyPanel.svelte";
	import TextField from "./fields/TextField.svelte";
	import NumberField from "./fields/NumberField.svelte";
	import SelectField from "./fields/SelectField.svelte";
	import PetAppearanceIcon from "./PetAppearanceIcon.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	// Stable GUID keys keep each pet's field gesture attached across renaming.
	// Show all pets together because the friendship points are farm-wide.
	const pets = $derived(
		view.current?.pets.map((pet) => ({
			...pet,
			fields: createPetFields(pet, model),
		})) ?? [],
	);
</script>

<h1>Pets</h1>

<p class="guidance">
	Edit existing pets’ names, friendship and appearance. These changes are shared
	across farmers.
</p>

<p class="guidance">
	Friendship ranges from 0 to 1,000. The game handles love messages and adoption
	unlocks when it processes friendship. These edits do not grant rewards or
	change daily petting records.
</p>

{#if pets.length === 0}
	<p>No readable pet records were found in this farm’s locations.</p>
{:else}
	<div class="pets">
		{#each pets as pet (pet.key)}
			<StudyPanel title={pet.name}>
				<div class="pet-summary">
					{#if pet.appearance.icon}
						<PetAppearanceIcon
							icon={pet.appearance.icon}
							label={`${pet.type} — breed ${pet.breed}`}
						/>
					{/if}

					<p>{pet.type} · Breed {pet.breed} · {pet.location}</p>
				</div>

				<div class="fields">
					<TextField field={pet.fields.name} sensitive />

					<NumberField field={pet.fields.friendship} />

					<SelectField
						field={pet.fields.appearance}
						description="Choose a type and breed together. Changing type also changes sounds, behavior and possible gifts. The preview shows vanilla game art."
					/>
				</div>
			</StudyPanel>
		{/each}
	</div>
{/if}

<p class="guidance">
	Adoption, removal and bowl assignments are not editable here. Custom
	appearances stay unchanged unless you choose a supported replacement.
</p>

<style>
	h1 {
		margin: 0 0 12px;
		font-size: 34px;
	}
	.guidance {
		max-width: 72ch;
		color: #694621;
		line-height: 1.45;
	}
	.pets {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
		gap: 20px;
		margin: 24px 0;
	}
	.fields {
		display: grid;
		gap: 18px;
	}
	.pet-summary {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}
	.fields :global(input[type="number"]) {
		max-width: 160px;
	}
	p {
		overflow-wrap: anywhere;
	}
</style>
