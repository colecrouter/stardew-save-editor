<script lang="ts">
	import { Result } from "effect";
	import type { EditorModel } from "../editor-model.ts";
	import {
		decodeItemPropertyChange,
		type ItemPropertyField,
	} from "../item-properties.ts";
	import { setInventoryItemProperty } from "../inventory-operations.ts";

	let {
		model,
		farmerId,
		entityId,
		field,
	}: {
		model: EditorModel;
		farmerId: string;
		entityId: string;
		field: ItemPropertyField;
	} = $props();
	const id = $props.id();
	let error = $state("");
	let request = 0;
	let pending = $state<{
		value: ItemPropertyField["value"];
		request: number;
	}>();
	let cleared = $state<{ value: ItemPropertyField["value"] }>();
	const visible = $derived(pending?.value ?? field.value);
	$effect(() => {
		// An incomplete number is local input, never a missing saved property.
		// Own queued writes retain that blank; an external revision such as Undo
		// replaces it with the newly committed number.
		if (cleared && !pending && field.value !== cleared.value)
			cleared = undefined;
	});
	function readNumber() {
		return cleared
			? undefined
			: typeof visible === "number"
				? visible
				: undefined;
	}
	function writeNumber(value: number | null | undefined) {
		if (value == null) {
			cleared = { value: visible };
			error = "";
			return;
		}
		cleared = undefined;
		if (value !== visible) void update(value);
	}
	async function update(value: unknown) {
		error = "";
		// The parent keys this inspector by item identity. Capture that target before
		// yielding so a later selection cannot redirect an already queued field edit.
		const decoded = decodeItemPropertyChange({
			farmerId,
			entityId,
			property: field.property,
			value,
		});
		if (Result.isFailure(decoded)) {
			error = decoded.failure.message;
			return;
		}
		if (decoded.success.value === visible) return;
		const current = ++request;
		pending = { value: decoded.success.value, request: current };
		try {
			const result = await model.commands.transact(
				setInventoryItemProperty(decoded.success),
			);
			if (result && Result.isFailure(result) && pending?.request === current)
				error = result.failure.message;
			// Defects and cancellation remain owned by the shared command boundary.
		} finally {
			// The latest request owns the control until its committed projection arrives;
			// earlier completions must not replace more recent typing or steal focus.
			if (pending?.request === current) pending = undefined;
		}
	}
</script>

<div class="property" class:boolean={field.kind === "boolean"}>
	{#if field.kind === "boolean"}
		<label class="checkbox" title={field.title}>
			<input
				type="checkbox"
				aria-describedby={error || field.hint ? `${id}-hint` : undefined}
				bind:checked={() => visible === true, (value) => void update(value)}
			/>

			<span>{field.label}</span>
		</label>
	{:else}
		<label for={id} title={field.title}>{field.label}</label>

		{#if field.kind === "number"}
			<input
				{id}
				type="number"
				min={field.min}
				max={field.max}
				step={field.step ?? 1}
				readonly={field.min !== undefined && field.min === field.max}
				aria-invalid={error ? "true" : undefined}
				aria-describedby={error || field.hint ? `${id}-hint` : undefined}
				bind:value={readNumber, writeNumber}
			/>
		{:else if field.kind === "color"}
			<div class="color-control">
				<input
					{id}
					type="color"
					aria-invalid={error ? "true" : undefined}
					aria-describedby={error || field.hint ? `${id}-hint` : undefined}
					bind:value={
						() => (typeof visible === "string" ? visible : "#000000"),
						(value) => void update(value)
					}
				/>

				<span class="color-value">{visible}</span>
			</div>
		{:else if field.kind === "select"}
			<select
				{id}
				aria-invalid={error ? "true" : undefined}
				aria-describedby={error || field.hint ? `${id}-hint` : undefined}
				bind:value={() => visible, (value) => void update(value)}
			>
				{#each field.options ?? [] as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		{/if}
	{/if}

	{#if error || field.hint}
		<p
			id={`${id}-hint`}
			class:error={error !== ""}
			role={error ? "status" : undefined}
		>
			{error || field.hint}
		</p>
	{/if}
</div>

<style>
	.property {
		display: grid;
		align-content: start;
		gap: 7px;
		min-width: 0;
	}
	label {
		min-width: 0;
	}
	input,
	select {
		min-width: 0;
		width: 100%;
		min-height: 42px;
		font: inherit;
		color: #311304;
		background: #fff2d3;
		border: 2px solid #b98b52;
		padding: 5px 8px;
	}
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 2px;
	}
	.checkbox {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 42px;
		cursor: pointer;
	}
	.checkbox input {
		width: 22px;
		height: 22px;
		min-height: 0;
		flex: none;
		accent-color: #176fb4;
	}
	.color-control {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	input[type="color"] {
		width: 56px;
		padding: 3px;
		cursor: pointer;
		flex: none;
	}
	.color-value {
		font-size: 17px;
		overflow-wrap: anywhere;
	}
	p {
		margin: 0;
		color: #694621;
		font-size: 17px;
		line-height: 1.25;
	}
	p.error {
		color: #8c2f1b;
	}
</style>
