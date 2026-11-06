<script lang="ts">
	import { tick } from "svelte";
	import { ItemDescription, ItemNameHelper } from "$lib/ItemData";
	import type { ParentIndex } from "$lib/ItemParentIndex";
	import { Raw } from "$lib/proxies";
	import { Color } from "$lib/proxies/Color.svelte";
	import {
		BaseItemProxy,
		BootsProxy,
		ClothingProxy,
		ColoredObjectProxy,
		FurnitureProxy,
		type ItemProxy,
		ObjectProxy,
		TrinketProxy,
		WateringCanProxy,
		WeaponProxy,
	} from "$lib/proxies/items";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import {
		FROG_VARIANTS,
		parrotEggMaxLevel,
		QUIVER_TYPES,
		type QuiverType,
		type TrinketRollContext,
		type TrinketStats,
	} from "$lib/TrinketStats";
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import ItemSelect from "./ItemSelect.svelte";
	import ItemSlot from "./ItemSlot.svelte";
	import ItemSprite from "./ItemSprite.svelte";
	import QualitySelector from "./QualitySelector.svelte";

	interface Props {
		selectedItem: ItemProxy | undefined;
		selectedIndex: ParentIndex | undefined;
		deleteItem: () => void;
		createItem: (name: string) => void;
	}

	let {
		selectedItem = $bindable(),
		selectedIndex,
		deleteItem,
		createItem,
	}: Props = $props();

	const save = getSaveManager().save;

	// A different slot or item must never inherit a pending removal confirmation.
	let removalTarget = $state<ItemProxy>();
	let editorRoot: HTMLDivElement;

	async function focusRemovalControl(selector: string) {
		// Wait for the replacement controls before restoring the keyboard's task position.
		await tick();
		editorRoot?.querySelector<HTMLElement>(selector)?.focus();
	}
	$effect(() => {
		// Selection changes cancel the prompt even when a moved item keeps its identity.
		selectedItem;
		selectedIndex;
		removalTarget = undefined;
	});
	let confirmingRemoval = $derived(
		selectedItem !== undefined && removalTarget === selectedItem,
	);
	let slotLabel = $derived(
		typeof selectedIndex === "number"
			? `Slot ${selectedIndex + 1}`
			: selectedIndex?.replace(/([A-Z])/g, " $1"),
	);

	let description = $derived(ItemDescription(selectedItem?.info));

	// Trinket stats are rolled from their seed by the game, so editing them picks a new seed
	let trinketCtx: TrinketRollContext = $derived({
		useLegacyRandom: save?.raw.SaveGame.useLegacyRandom === true,
		totalMoneyEarned: save?.player.totalMoneyEarned ?? 0,
	});

	type StatField = {
		label: string;
		key: string;
		value: number;
		min: number;
		max: number;
		step: number;
		/** Shown after the input so the user can see the best possible value */
		hint: string;
		title?: string;
	};

	const fmt = (n: number, digits = 1) => n.toFixed(digits);

	function trinketFields(
		stats: TrinketStats,
		ctx: TrinketRollContext,
	): StatField[] {
		switch (stats.kind) {
			case "FairyBox":
				return [
					{
						label: "Level",
						key: "level",
						value: stats.level,
						min: 1,
						max: 5,
						step: 1,
						hint: "/ 5",
					},
				];
			case "ParrotEgg": {
				const cap = parrotEggMaxLevel(ctx.totalMoneyEarned);
				return [
					{
						label: "Level",
						key: "level",
						value: stats.level,
						min: 1,
						max: cap,
						step: 1,
						hint: cap < 4 ? `/ ${cap} (4)` : "/ 4",
						title:
							"Max level is set by total money earned: +1 per 750,000g, up to 4",
					},
				];
			}
			case "IceRod":
				return [
					{
						label: "Orb Interval",
						key: "interval",
						value: stats.interval,
						min: 3,
						max: 5,
						step: 0.1,
						hint: "s · best 3.0",
					},
					{
						label: "Freeze Time",
						key: "freeze",
						value: stats.freeze,
						min: 2,
						max: 4,
						step: 0.1,
						hint: "/ 4.0 s",
					},
				];
			case "IridiumSpur":
				return [
					{
						label: "Speed Boost",
						key: "duration",
						value: stats.duration,
						min: 5,
						max: 10,
						step: 1,
						hint: "/ 10 s",
					},
				];
			case "MagicQuiver": {
				const range = QUIVER_TYPES[stats.type];
				const [, bestMin] = range.minDamage;
				const [fastest] = range.delay;
				const digits = range.delayStep < 0.1 ? 2 : 1;
				return [
					{
						label: "Damage",
						key: "minDamage",
						value: stats.minDamage,
						min: range.minDamage[0],
						max: bestMin,
						step: 1,
						hint: `+ 5 (${stats.maxDamage}) · best ${bestMin}–${bestMin + 5}`,
					},
					{
						label: "Fire Rate",
						key: "delay",
						value: stats.delay,
						min: fastest,
						max: range.delay[1],
						step: range.delayStep,
						hint: `s · best ${fmt(fastest, digits)}`,
						title: "Seconds between shots (lower is better)",
					},
				];
			}
			case "FrogEgg":
				return [];
		}
	}

	type Properties<T extends ItemProxy> = [
		string,
		keyof T,
		number | null,
		number | null,
		number | undefined,
	][];

	type PropertyGroup<T extends ItemProxy> = {
		// biome-ignore lint/suspicious/noExplicitAny: unavoidable
		ctor: new (...args: any[]) => T;
		props: Properties<T>;
	};

	const pg = <T extends ItemProxy>(
		// biome-ignore lint/suspicious/noExplicitAny: unavoidable
		ctor: new (...args: any[]) => T,
		props: Properties<T>,
	): PropertyGroup<T> => ({ ctor, props });

	const properties = [
		pg(BaseItemProxy, [["Amount", "amount", 1, 9999, undefined]]),
		pg(WeaponProxy, [
			["Min Dmg", "minDamage", 0, 999, undefined],
			["Max Dmg", "maxDamage", 0, 999, undefined],
			["Knockback", "knockback", 0, 999, undefined],
			["Speed", "speed", -999, 999, undefined],
			["Precision", "precision", 0, 999, undefined],
			["Defense", "defense", 0, 999, undefined],
			["Area of Effect", "areaOfEffect", 0, 999, undefined],
			["Crit Chance", "critChance", 0, 1, 0.01],
			["Crit Multiplier", "critMultiplier", 0, 999, 0.1],
		]),
		pg(ObjectProxy, [
			["Edibility", "edibility", -999, 999, undefined],
			["Price", "price", 0, 2 ** 31 - 1, undefined], // 32 bit signed int
			["Quality", "quality", null, null, undefined],
		]),
		pg(ColoredObjectProxy, [["Color", "color", null, null, undefined]]),
		pg(FurnitureProxy, [
			// ["Place Outdoors", "setOutdoors", 0, 1],
			// ["Place Indoors", "setIndoors", 0, 1],
			// ["Produces Light", "isLamp", 0, 1],
		]),
		pg(ClothingProxy, [["Color", "color", null, null, undefined]]),
		pg(BootsProxy, [
			["Defense", "defenseBonus", 0, 99, undefined],
			["Immunity", "immunityBonus", 0, 99, undefined],
		]),
		pg(WateringCanProxy, [
			["Bottomless", "isBottomless", null, null, undefined],
		]),
	];
</script>

{#snippet inputField<T extends ItemProxy>(
	selectedItem: T,
	label: string,
	key: keyof T,
	min?: number,
	max?: number,
	step?: number,
)}
	{#if key in selectedItem && selectedItem[key] !== undefined}
		<label>
			<small>{label}</small>
			{#if key === "quality" && selectedItem instanceof ObjectProxy}
				<QualitySelector item={selectedItem} />
			{:else if typeof selectedItem[key] === "number"}
				<UiInput
					type="number"
					bind:value={selectedItem[key]}
					data-testid={`property-${String(key)}`}
					{min}
					{max}
					{step}
				/>
			{:else if typeof selectedItem[key] === "string"}
				<UiInput type="text" bind:value={selectedItem[key]} />
			{:else if typeof selectedItem[key] === "boolean"}
				<UiCheckbox
					bind:checked={selectedItem[key]}
					data-testid={`property-${String(key)}`}
				/>
			{:else if selectedItem[key] instanceof Color}
				<UiInput
					type="color"
					value={selectedItem[key].toHex()}
					onchange={(e) => {
						if (!selectedItem) return;
						// @ts-expect-error some props are readonly
						selectedItem[key] = new Color(
							// @ts-expect-error
							e.target.value,
						);
					}}
					data-testid="color-picker"
				/>
			{/if}
		</label>
	{/if}
{/snippet}

<div class="editor" bind:this={editorRoot}>
	<!-- Identity leads the inspector; the name is information, not a disabled input. -->
	<header class="item-heading">
		<div class="big-icon" aria-hidden="true" inert>
			<ItemSlot item={selectedItem}><ItemSprite item={selectedItem} /></ItemSlot
			>
		</div>
		<div>
			<h3>
				{selectedItem
					? (ItemNameHelper(selectedItem[Raw]) ?? "Unknown item")
					: "Add an item"}
			</h3>
			<p class="slot-label">
				{slotLabel ?? "Select a slot"}{selectedItem
					? " · Changes update immediately"
					: " · Empty"}
			</p>
		</div>
	</header>
	{#if description}
		<p class="description" data-testid="item-description">{description}</p>
	{/if}

	<!-- Keep every supported property available, grouped in a compact scanning order. -->
	<div class="stats">
		{#if selectedItem}
			{#each properties as { ctor, props }}
				{#if selectedItem instanceof ctor}
					{#each props as [label, key, min, max, step]}
						{@render inputField(
							selectedItem as InstanceType<typeof ctor>,
							label,
							key as any,
							min ?? undefined,
							max ?? undefined,
							step,
						)}
					{/each}
				{/if}
			{/each}
			{#if selectedItem instanceof TrinketProxy}
				{@const trinket = selectedItem}
				{@const stats = trinket.getStats(trinketCtx)}
				{#if stats?.kind === "MagicQuiver"}
					<label>
						<small>Type</small>
						<UiSelect
							bind:value={
								() => stats.type,
								(v) => {
									const type = v as QuiverType;
									const range = QUIVER_TYPES[type];
									// Keep the stats as close as the new type allows
									trinket.setStats(
										{
											...stats,
											type,
											minDamage: stats.minDamage,
											delay: range.delay[0],
										},
										trinketCtx,
									);
								}
							}
							data-testid="property-quiverType"
						>
							{#each Object.entries(QUIVER_TYPES) as [type, range]}
								<option value={type}>{range.label}</option>
							{/each}
						</UiSelect>
					</label>
				{:else if stats?.kind === "FrogEgg"}
					<label>
						<small>Color</small>
						<UiSelect
							bind:value={
								() => stats.variant,
								(v) =>
									trinket.setStats({ ...stats, variant: Number(v) }, trinketCtx)
							}
							data-testid="property-frogVariant"
						>
							{#each FROG_VARIANTS as name, variant}
								<option value={variant}>{name}</option>
							{/each}
						</UiSelect>
					</label>
				{/if}
				{#if stats}
					{#each trinketFields(stats, trinketCtx) as field (field.key)}
						<label title={field.title}>
							<small>{field.label}</small>
							<span class="stat">
								<UiInput
									type="number"
									min={field.min}
									max={field.max}
									step={field.step}
									disabled={field.min === field.max}
									bind:value={
										() => field.value,
										(v) => {
											// Cleared while typing: wait for a number instead of rolling to 0
											if (v === null) return;
											trinket.setStats(
												{ ...stats, [field.key]: Number(v) },
												trinketCtx,
											);
										}
									}
									data-testid={`property-${field.key}`}
								/>
								<span class="hint">{field.hint}</span>
							</span>
						</label>
					{/each}
				{/if}
			{/if}
		{:else if selectedIndex !== undefined}
			<div class="add-item">
				<p>Search by item name or ID, then choose an item to fill this slot.</p>
				<!-- Each empty slot owns its search text independently. -->
				{#key selectedIndex}
					<ItemSelect onsubmit={createItem} />
				{/key}
			</div>
		{/if}
	</div>

	<!-- Confirm inline so removing an item cannot be mistaken for editing a stat. -->
	{#if selectedItem}
		<footer class="item-actions">
			{#if confirmingRemoval}
				<p>
					Remove {ItemNameHelper(selectedItem[Raw]) ?? "this item"} from {slotLabel?.toLowerCase()}?
				</p>
				<div class="action-buttons">
					<UiButton
						variant="plain"
						onclick={() => {
							if (selectedIndex !== undefined) deleteItem();
							removalTarget = undefined;
							focusRemovalControl('[data-testid="item-name"]');
						}}>Remove item</UiButton
					>
					<UiButton
						variant="plain"
						data-keep-item
						onclick={() => {
							removalTarget = undefined;
							focusRemovalControl("[data-remove-trigger]");
						}}>Keep item</UiButton
					>
				</div>
			{:else}
				<UiButton
					variant="plain"
					data-remove-trigger
					onclick={() => {
						removalTarget = selectedItem;
						focusRemovalControl("[data-keep-item]");
					}}>Remove item…</UiButton
				>
			{/if}
		</footer>
	{/if}
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 20px;
		min-width: 0;
		color: #311304;
	}
	.item-heading {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.item-heading h3 {
		margin: 0 0 6px;
		overflow-wrap: anywhere;
	}
	.big-icon {
		pointer-events: none;
		flex: 0 0 auto;
		zoom: 1.5;
	}
	.slot-label {
		margin: 0;
		color: #694621;
		font-size: 18px;
	}
	.description {
		margin: 0;
		max-width: 65ch;
		white-space: pre-line;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px 24px;
	}
	.stats label {
		display: flex;
		flex-direction: column;
		align-items: start;
		gap: 6px;
		min-width: 0;
	}
	.stats label :global(input:not([type="color"])),
	.stats label :global(.select-wrapper) {
		width: 100%;
		min-width: 0;
	}
	.stats small {
		margin: 0;
	}
	.stat {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		width: 100%;
	}
	.hint {
		color: #694621;
		font-size: 18px;
	}
	.add-item {
		grid-column: 1 / -1;
		min-width: 0;
	}
	.add-item p {
		margin: 0 0 16px;
	}
	.item-actions {
		border-top: 1px solid #be8d4d;
		padding-top: 16px;
	}
	.item-actions p {
		margin: 0 0 12px;
	}
	.item-actions :global(button) {
		color: #86291e;
	}
	.action-buttons {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	@media (max-width: 480px) {
		.stats {
			gap: 16px;
		}
		.item-heading {
			align-items: start;
			gap: 12px;
		}
	}
</style>
