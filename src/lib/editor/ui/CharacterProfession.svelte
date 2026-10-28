<script lang="ts">
	import { Result } from "effect";
	import type { EditorModel } from "../editor-model.ts";
	import { setCharacter } from "../character-operations.ts";

	let {
		model,
		farmerId,
		profession,
		checked,
		disabled = false,
		description,
	}: {
		model: EditorModel;
		farmerId: string;
		profession: { id: number; name: string };
		checked: boolean;
		disabled?: boolean;
		description: string;
	} = $props();
	const id = $props.id();
	let pending = $state<{ value: boolean; request: number }>();
	let request = 0;
	let error = $state("");
	const visible = $derived(pending?.value ?? checked);
	async function update(enabled: boolean) {
		const current = ++request;
		pending = { value: enabled, request: current };
		error = "";
		// Capture the selected farmer and profession synchronously. A queued write
		// keeps its original target if the user switches farmers before it completes.
		const operation = setCharacter({
			farmerId,
			kind: "profession",
			profession: profession.id,
			enabled,
		});
		try {
			const result = await model.commands.transact(operation);
			if (result && Result.isFailure(result) && pending?.request === current)
				error = result.failure.message;
		} finally {
			if (pending?.request === current) pending = undefined;
		}
	}
</script>

<div class="profession">
	<label>
		<input
			type="checkbox"
			{disabled}
			aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
			bind:checked={() => visible, (value) => void update(value)}
		/>

		<span>{profession.name}</span>
	</label>

	<p id={`${id}-description`}>{description}</p>

	{#if error}
		<p class="error" id={`${id}-error`} role="status">{error}</p>
	{/if}
</div>

<style>
	.profession {
		min-width: 0;
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		cursor: pointer;
	}
	input {
		width: 20px;
		height: 20px;
		flex: none;
		accent-color: #246f44;
		cursor: inherit;
	}
	input:focus-visible {
		outline: 2px solid #311304;
		outline-offset: 3px;
	}
	label:has(input:disabled) {
		color: #694621;
		cursor: default;
	}
	p {
		font-size: 17px;
		line-height: 1.25;
		color: #694621;
		margin: 0 0 4px 28px;
	}
	.error {
		color: #8a1c19;
	}
</style>
