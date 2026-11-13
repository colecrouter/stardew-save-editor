<script lang="ts">
	import { Effect, Result } from "effect";
	import { onMount } from "svelte";
	import { Combobox } from "bits-ui";
	import { runEntryCommand } from "../entry-operations.ts";
	import type { CatalogChoice } from "../item-catalog.ts";
	import type { ChildView } from "../children-data.ts";
	import { resolveItemMetadata } from "../item-presentation.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
	let {
		hat,
		value,
		stage,
		disabled,
		onchange,
		onpreview,
	}: {
		hat: ChildView["hat"];
		value: string;
		stage?: number;
		disabled: boolean;
		onchange: (value: string) => void;
		onpreview: (value: string, hat: ChildView["hat"]) => void;
	} = $props();
	let choices = $state<readonly CatalogChoice[]>([]);
	let query = $state("");
	let open = $state(false);
	let search = $state<(query: string) => readonly CatalogChoice[]>(() => []);
	let loading = $state(true);
	let error = $state("");
	// Reuse Inventory's trusted catalog and drawing instructions. Loading belongs
	// to this mounted editor; late module completion cannot update a closed picker.
	onMount(() => {
		let active = true;
		void runEntryCommand(
			Effect.promise(() => import("../item-catalog.ts")),
			(message) => {
				if (active) error = message;
			},
			{
				context: "child-hats",
				message: "The hat catalog could not be loaded.",
			},
		).then((result) => {
			if (!active) return;
			if (result && Result.isSuccess(result)) {
				choices = result.success.catalogChoices.filter(
					(choice) => choice.kind === "Hat",
				);
				search = (query) => result.success.searchCatalog(query, "Hat", choices);
			}
			loading = false;
		});
		return () => {
			active = false;
		};
	});
	const selected = $derived(
		choices.find((choice) => `catalog:${choice.id}` === value),
	);
	// Match the inventory catalog's names and IDs, and show results immediately
	// below the input rather than hiding a filtered list inside a native select.
	const shown = $derived(search(query));
	// Saved/empty choices participate in text filtering too, so keyboard search
	// lands on the first matching hat rather than an unrelated preservation action.
	const showKeep = $derived(
		`Keep saved hat ${hat.name}`
			.toLowerCase()
			.includes(query.trim().toLowerCase()),
	);
	const showRemove = $derived("no hat".includes(query.trim().toLowerCase()));
	const label = $derived(
		value === "remove" ? "No hat" : (selected?.name ?? hat.name),
	);
	const visual = $derived(
		value === "remove" ? undefined : (selected?.visual ?? hat.visual),
	);
	$effect(() => {
		const metadata = selected
			? resolveItemMetadata({
					$type: "StardewValley.Objects.Hat",
					itemId: selected.qualifiedId.replace(/^\(H\)/, ""),
				})
			: undefined;
		onpreview(
			value,
			value === "remove"
				? { present: false, name: "No hat" }
				: selected
					? {
							present: true,
							name: selected.name,
							visual: selected.visual,
							hideHair: metadata?._type === "Hat" && !metadata.showRealHair,
						}
					: hat,
		);
	});
</script>

<div class="hat-picker">
	<div class="hat-preview">
		{#if visual}
			<BackpackItemVisual {visual} size={48} />
		{/if}

		<span>{label}</span>
	</div>

	<StudyField
		label="Hat"
		description={stage === 3
			? "Search by hat name or ID. Replacement or removal discards the saved hat item; Undo restores it."
			: "Only toddlers can equip hats. An existing hat can be kept or explicitly removed."}
		{error}
	>
		{#snippet children(attributes)}
			<Combobox.Root
				type="single"
				{value}
				bind:open
				inputValue={open ? query : label}
				allowDeselect={false}
				{disabled}
				onOpenChange={(opened) => {
					if (!opened) query = "";
				}}
				onValueChange={onchange}
			>
				<div class="control">
					<Combobox.Input
						{...attributes}
						class="study-input"
						placeholder="Hat name or ID"
						onclick={() => {
							if (!open) query = "";
							open = true;
						}}
						oninput={(event) => {
							query = event.currentTarget.value;
							open = true;
						}}
					/>

					<Combobox.Trigger aria-label="Browse hats">&#9662;</Combobox.Trigger>
				</div>

				<Combobox.Portal>
					<Combobox.Content
						class="study-kit hat-options"
						sideOffset={4}
						align="start"
					>
						<Combobox.Viewport>
							{#if showKeep}
								<Combobox.Item value="keep" label={hat.name} class="hat-option">
									<span>Keep saved hat &middot; {hat.name}</span>
								</Combobox.Item>
							{/if}

							{#if showRemove}
								<Combobox.Item value="remove" label="No hat" class="hat-option">
									<span aria-hidden="true">&mdash;</span>

									<span>No hat</span>
								</Combobox.Item>
							{/if}

							{#if stage === 3}
								{#each shown as choice (choice.id)}
									<Combobox.Item
										value={`catalog:${choice.id}`}
										label={choice.name}
										class="hat-option"
									>
										<BackpackItemVisual visual={choice.visual} />

										<span>
											{choice.name}
											<small>{choice.qualifiedId}</small>
										</span>
									</Combobox.Item>
								{/each}

								{#if !loading && shown.length === 0 && !showKeep && !showRemove}
									<p role="status">No hats found.</p>
								{/if}
							{/if}
						</Combobox.Viewport>
					</Combobox.Content>
				</Combobox.Portal>
			</Combobox.Root>
		{/snippet}
	</StudyField>

	{#if loading}
		<p>Loading hats…</p>
	{/if}
</div>

<style>
	.control {
		display: flex;
	}
	.control :global(button) {
		border: 2px solid var(--study-rule, #987746);
		background: var(--study-paper-inset, #f5dbab);
		padding: 0 14px;
	}
	:global(.hat-options) {
		z-index: 120;
		width: var(--bits-combobox-anchor-width);
		min-width: 280px;
		max-height: 320px;
		overflow-y: auto;
		border: 2px solid var(--study-rule, #987746);
		background: var(--study-paper-light, #fff1d2);
		padding: 6px;
	}
	:global(.hat-option) {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 6px 10px;
		cursor: pointer;
	}
	:global(.hat-option[data-highlighted]) {
		background: var(--study-paper-inset, #f5dbab);
		outline: 1px solid var(--study-rule, #987746);
	}
	:global(.hat-option small) {
		display: block;
		opacity: 0.7;
	}
	.hat-picker {
		display: grid;
		gap: 14px;
		min-width: 0;
	}
	.hat-preview {
		display: flex;
		gap: 14px;
		align-items: center;
		min-height: 52px;
	}
	.hat-preview span {
		overflow-wrap: anywhere;
	}
</style>
