<script lang="ts">
	import { defaultAnimalName, describeUnplaced } from "$lib/animalBuildings";
	import type { Building } from "$lib/proxies/Building.svelte";
	import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";
	import { getToastManager, Toast } from "$lib/ToastManager.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";

	interface Props {
		building: Building;
		save: SaveProxy;
	}

	let { building, save }: Props = $props();

	const toastManager = getToastManager();
	const notify = (message: string, type: "success" | "failure") =>
		toastManager?.add(new Toast(message, type));
	const errorMessage = (e: unknown) =>
		e instanceof Error ? e.message : String(e);

	// Upgrading and downgrading
	const tiers = $derived(building.tiers);
	const tierIndex = $derived(tiers.findIndex((t) => t.name === building.name));
	const blockers = $derived(
		new Map(
			tiers.map((tier) => [
				tier.name,
				tier.name === building.name
					? undefined
					: building.tierChangeBlocker(tier),
			]),
		),
	);
	const reasons = $derived([
		...new Set([...blockers.values()].filter((r) => r !== undefined)),
	]);
	const canDowngrade = $derived(
		tiers
			.slice(0, Math.max(tierIndex, 0))
			.some((tier) => blockers.get(tier.name) === undefined),
	);

	const changeType = (select: HTMLSelectElement) => {
		const index = tiers.findIndex((t) => t.name === select.value);
		const target = tiers[index];
		if (target && index !== tierIndex) {
			const upgrade = index > tierIndex;
			try {
				const problems = building.changeType(target);
				notify(
					`${upgrade ? "Upgraded" : "Downgraded"} to a ${target.name}`,
					"success",
				);
				for (const problem of problems)
					notify(
						`${upgrade ? "Couldn't add the" : "Left the"} ${describeUnplaced(problem)}`,
						"failure",
					);
			} catch (e) {
				notify(errorMessage(e), "failure");
			}
		}
		// Show the real type if the change was refused
		select.value = building.name ?? "";
	};

	// Adding animals
	const options = $derived(building.animalOptions);
	let chosenType = $state<string>();
	const type = $derived(
		options.find((o) => o.allowed && o.type === chosenType) ??
			options.find((o) => o.allowed),
	);
	const takenNames = $derived(new Set(save.farmAnimals.map((a) => a.name)));
	/** What the player typed; until then, the name follows the type */
	let typedName = $state<string>();
	const name = $derived(
		typedName ?? (type ? defaultAnimalName(type.type, takenNames) : ""),
	);
	const nameError = $derived.by(() => {
		const trimmed = name.trim();
		if (!trimmed) return "The animal needs a name";
		if (takenNames.has(trimmed))
			return `Another animal is already called ${trimmed}`;
		return undefined;
	});
	const canAdd = $derived(
		!!type && !nameError && !building.isFull && !building.underConstruction,
	);

	const add = (event: SubmitEvent) => {
		event.preventDefault();
		if (!type || !canAdd) return;
		try {
			const animal = building.adoptAnimal(type.type, name, save.player);
			notify(
				`${animal.name} the ${animal.type} moved into the ${building.name}`,
				"success",
			);
			typedName = undefined;
		} catch (e) {
			notify(errorMessage(e), "failure");
		}
	};
</script>

<div class="building-controls">
	{#if tiers.length > 1}
		<label class="row">
			<small>Upgrade:</small>
			<select
				value={building.name}
				onchange={(e) => changeType(e.currentTarget)}
				data-testid="building-upgrade"
			>
				{#each tiers as tier (tier.name)}
					<option
						value={tier.name}
						disabled={blockers.get(tier.name) !== undefined}
						title={blockers.get(tier.name)}
						>{tier.name}{building.isAnimalHouse
							? ` (${tier.maxOccupants} animals)`
							: ""}</option
					>
				{/each}
			</select>
		</label>
		{#if reasons.length}
			<small class="note" data-testid="building-upgrade-reason"
				>{reasons.join(". ")}</small
			>
		{/if}
		{#if canDowngrade}
			<small class="note" data-testid="building-downgrade-note"
				>A downgrade moves back what the upgrade moved. Anything else in the
				extra space stays there, out of reach until it's upgraded again.</small
			>
		{/if}
	{/if}

	{#if building.isAnimalHouse}
		{#if !options.length}
			<!-- A modded coop or barn, probably -->
			<small class="note" data-testid="add-animal-unknown"
				>The editor doesn't know which animals can live in a {building.name}.</small
			>
		{:else}
			<form
				class="row"
				onsubmit={add}
				aria-label={`Add an animal to the ${building.name}`}
			>
				<small>Add animal:</small>
				<select
					value={type?.type ?? ""}
					onchange={(e) => (chosenType = e.currentTarget.value)}
					aria-label="Animal type"
					data-testid="add-animal-type"
				>
					{#each options as option (option.type)}
						<option value={option.type} disabled={!option.allowed}
							>{option.type}{option.reason ? ` (${option.reason})` : ""}</option
						>
					{/each}
				</select>
				<UiInput
					type="text"
					bind:value={() => name, (value) => (typedName = String(value ?? ""))}
					aria-label="Name"
					aria-invalid={nameError !== undefined}
					data-testid="add-animal-name"
				/>
				<button type="submit" disabled={!canAdd} data-testid="add-animal-submit"
					>Add</button
				>
			</form>
			{#if building.underConstruction}
				<small class="note" data-testid="add-animal-under-construction"
					>Animals can move in once it's built.</small
				>
			{:else if building.isFull}
				<small class="note" data-testid="add-animal-full"
					>Full: {building.residentIds.length}/{building.capacity} animals live here.{tierIndex <
					tiers.length - 1
						? " Upgrade it for more room."
						: ""}</small
				>
			{:else if nameError && typedName !== undefined}
				<small class="note error" data-testid="add-animal-name-error"
					>{nameError}</small
				>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.building-controls {
		display: grid;
		gap: 4px;
		margin: 6px 0;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	select,
	button {
		font: inherit;
		font-size: 0.85em;
		padding: 1px 4px;
		border: solid 2px #9c613b;
		border-radius: 4px;
		background-color: #f9bb65;
		color: inherit;
		cursor: pointer;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.row :global(input[type="text"]) {
		width: 9em;
		font-size: 0.85em;
	}

	.note {
		font-size: 0.75em;
		opacity: 0.8;
	}

	.error {
		color: #a01010;
		opacity: 1;
	}
</style>
