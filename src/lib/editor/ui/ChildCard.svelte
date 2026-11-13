<script lang="ts">
	import { tick, untrack } from "svelte";
	import type { ChildView } from "../children-data.ts";
	import type { EditorModel } from "../editor-model.ts";
	import {
		createChildEditField,
		type ChildEditDraft,
	} from "../children-domain.ts";
	import { childStage, childStages } from "../children-data.ts";
	import { createRuneDraft } from "../field.svelte.ts";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyField from "../../ui/kit/StudyField.svelte";
	import ChildPortrait from "./ChildPortrait.svelte";
	import ChildHatPicker from "./ChildHatPicker.svelte";
	interface Props {
		child: ChildView;
		model: EditorModel;
	}
	let { child, model }: Props = $props();
	const triggerId = $props.id();
	let nameInput = $state<HTMLInputElement>();
	// The keyed resident keeps one stable field/controller across publications.
	// Clean values refresh; dirty values conflict instead of retargeting on Undo.
	const field = untrack(() => createChildEditField(child.key, model));
	const draft = createRuneDraft(() => field);
	let editing = $state(false);
	// Couple catalog preview metadata to its draft value so Cancel, Undo and
	// later publications cannot accidentally reuse a previous replacement hat.
	let hatPreview = $state<{ value: string; hat: ChildView["hat"] }>();
	async function open() {
		editing = true;
		await tick();
		nameInput?.focus();
	}
	async function cancel() {
		// Cancel abandons all draft fields and returns keyboard focus to this card.
		// A disposed card has no trigger element, so late delivery does nothing.
		draft.reload();
		editing = false;
		await tick();
		document.getElementById(triggerId)?.focus();
	}
	// JSON is the shared draft controller's text representation of this local
	// structured form, never raw save data. Partial number input remains a string.
	const values = $derived(JSON.parse(draft.current.text) as ChildEditDraft);
	const preview = $derived({
		...child,
		hat:
			values.hat === "keep"
				? child.hat
				: values.hat === "remove"
					? { present: false, name: "No hat" }
					: hatPreview?.value === values.hat
						? hatPreview.hat
						: child.hat,
		gender: values.gender || child.gender,
		darkSkinned: values.skin ? values.skin === "dark" : child.darkSkinned,
		stage:
			/^\d+$/.test(values.daysOld) &&
			values.daysOld !== draft.current.base.value.daysOld
				? childStage(Number(values.daysOld))
				: child.stage,
	});
	// Keep the age caption aligned with the staged sprite while the saved age
	// remains unchanged until Apply. Incomplete input retains the saved caption.
	const shownAge = $derived(
		editing && /^\d+$/.test(values.daysOld)
			? Number(values.daysOld)
			: child.daysOld,
	);
	function change(patch: Partial<ChildEditDraft>) {
		draft.input(JSON.stringify({ ...values, ...patch }));
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		await draft.submit();
	}
</script>

<section aria-label={`${child.name || "Unnamed child"} child`}>
	<div class="identity">
		<ChildPortrait child={editing ? preview : child} />

		<div class="profile">
			<div class="name-line">
				<h3>{child.name || "Unnamed child"}</h3>

				{#if (editing ? preview.stage : child.stage) !== undefined}
					<span class="stage">
						{childStages[editing ? preview.stage! : child.stage!]?.label}
					</span>
				{/if}
			</div>

			<p class="age">
				{shownAge === undefined ? "Unknown age" : `${shownAge} days old`}
			</p>

			<dl>
				<div>
					<dt>Saved parent</dt>
					<dd>{child.parent}</dd>
				</div>

				<div>
					<dt>Home</dt>
					<dd>{child.home}</dd>
				</div>
			</dl>
		</div>

		{#if !editing}
			<StudyButton id={triggerId} disabled={!child.supported} onclick={open}>
				Edit child
			</StudyButton>
		{/if}
	</div>

	{#if editing}
		<form onsubmit={submit}>
			<p class="preview-note">
				Preview your changes, then apply them together.
			</p>

			<div class="details-grid">
				<div class="name-field">
					<StudyField
						label={`New name for ${child.name || "unnamed child"}`}
						description={child.reason}
					>
						{#snippet children(attributes)}
							<input
								bind:this={nameInput}
								{...attributes}
								class="study-input"
								type="text"
								required
								disabled={!child.supported || draft.current.pending}
								value={values.name}
								oninput={(event) => change({ name: event.currentTarget.value })}
							/>
						{/snippet}
					</StudyField>
				</div>

				<StudyField label="Gender">
					{#snippet children(attributes)}
						<select
							{...attributes}
							class="study-input"
							value={values.gender}
							disabled={draft.current.pending}
							onchange={(event) => {
								const gender = event.currentTarget.value;
								change({
									gender:
										gender === "Male" || gender === "Female" ? gender : "",
								});
							}}
						>
							{#if !values.gender}
								<option value="">
									Keep saved gender · {child.gender ?? "Unknown"}
								</option>
							{/if}
							<option value="Male">Male</option>
							<option value="Female">Female</option>
						</select>
					{/snippet}
				</StudyField>

				<StudyField label="Skin tone">
					{#snippet children(attributes)}
						<select
							{...attributes}
							class="study-input"
							value={values.skin}
							disabled={draft.current.pending}
							onchange={(event) => {
								const skin = event.currentTarget.value;
								change({
									skin: skin === "dark" || skin === "light" ? skin : "",
								});
							}}
						>
							{#if !values.skin}
								<option value="">Keep saved skin tone</option>
							{/if}
							<option value="light">Light</option>
							<option value="dark">Dark</option>
						</select>
					{/snippet}
				</StudyField>

				<StudyField
					label="Development stage"
					description="Choosing a stage sets its starting age."
				>
					{#snippet children(attributes)}
						<select
							{...attributes}
							class="study-input"
							value={preview.stage?.toString() ?? ""}
							disabled={draft.current.pending}
							onchange={(event) => {
								const value = event.currentTarget.value;
								const stage =
									value === "" ? undefined : childStages[Number(value)];
								if (stage) change({ daysOld: stage.days.toString() });
							}}
						>
							{#if preview.stage === undefined}
								<option value="">Unknown saved stage</option>
							{/if}
							{#each childStages as stage, index}
								<option value={index.toString()}>
									{stage.label} · {stage.days}{index === 3
										? "+"
										: `–${childStages[index + 1]!.days - 1}`} days
								</option>
							{/each}
						</select>
					{/snippet}
				</StudyField>

				<StudyField
					label="Days old"
					description="Age also determines sibling bed order. This does not simulate overnight events."
				>
					{#snippet children(attributes)}
						<input
							{...attributes}
							class="study-input"
							type="number"
							min="0"
							max="2147483646"
							step="1"
							value={values.daysOld}
							disabled={draft.current.pending}
							oninput={(event) =>
								change({ daysOld: event.currentTarget.value })}
						/>
					{/snippet}
				</StudyField>

				<div class="hat-field">
					<ChildHatPicker
						hat={child.hat}
						value={values.hat}
						stage={preview.stage}
						disabled={draft.current.pending}
						onchange={(hat) => change({ hat })}
						onpreview={(value, hat) => {
							hatPreview = { value, hat };
						}}
					/>
				</div>
			</div>

			{#if draft.current.error}
				<p class="error" role="status">{draft.current.error}</p>
			{/if}

			<div class="actions">
				<StudyButton
					type="submit"
					intent="constructive"
					pending={draft.current.pending}
					disabled={!child.supported || !draft.current.dirty}
				>
					Apply child changes
				</StudyButton>

				<StudyButton
					type="button"
					disabled={draft.current.pending}
					onclick={cancel}
				>
					Cancel changes
				</StudyButton>
			</div>
		</form>
	{:else if child.reason}
		<p>{child.reason}</p>
	{/if}
</section>

<style>
	section {
		padding: 22px;
		border: 2px solid var(--study-rule, #987746);
		background: var(--study-paper-light, #fff1d2);
		box-shadow: 3px 3px 0 var(--study-paper-inset, #e4c99e);
		min-width: 0;
	}
	.identity {
		display: flex;
		gap: 22px;
		align-items: center;
	}
	.profile {
		flex: 1;
		min-width: 0;
	}
	.name-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px 16px;
	}
	h3 {
		font-size: 28px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.stage {
		border: 1px solid var(--study-rule, #987746);
		padding: 2px 8px;
		font-size: 16px;
		color: var(--study-muted, #694621);
		background: var(--study-paper-inset, #f5dbab);
	}
	.age {
		margin: 4px 0 12px;
		color: var(--study-muted, #694621);
	}
	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 36px;
		margin: 0;
	}
	dt {
		color: var(--study-muted, #694621);
		font-size: 15px;
	}
	dd {
		margin: 2px 0 0;
		font-size: 19px;
		overflow-wrap: anywhere;
	}
	form {
		display: grid;
		gap: 14px 18px;
		border-top: 1px solid var(--study-rule, #987746);
		margin-top: 20px;
		padding-top: 18px;
	}
	.details-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
	}
	.name-field,
	.hat-field {
		grid-column: 1 / -1;
	}
	.preview-note {
		margin: 0;
		color: var(--study-muted, #694621);
	}
	.error {
		margin: 0;
		color: var(--ui-error, #b8312f);
	}
	.name-field {
		flex: 1 1 240px;
		min-width: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	@media (max-width: 480px) {
		.details-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.identity {
			flex-wrap: wrap;
		}
		section {
			padding: 16px;
		}
		.identity {
			gap: 14px;
			align-items: start;
		}
		dl {
			gap: 8px;
			flex-direction: column;
		}
		h3 {
			font-size: 25px;
		}
		.name-field {
			flex-basis: 100%;
		}
	}
</style>
