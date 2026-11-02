<script lang="ts">
	import StudyButton from "../../src/lib/ui/kit/StudyButton.svelte";
	import StudyField from "../../src/lib/ui/kit/StudyField.svelte";
	import StudyTabs from "../../src/lib/ui/kit/StudyTabs.svelte";
	import StudyAlert from "../../src/lib/ui/kit/StudyAlert.svelte";
	let { onclick, onsubmit }: { onclick: () => void; onsubmit: () => void } =
		$props();
	let value = $state("backpack");
</script>

<!-- Exercise native form defaults independently of domain field policies. -->
<form
	onsubmit={(event) => {
		event.preventDefault();
		onsubmit();
	}}
>
	<StudyButton {onclick}>Ordinary action</StudyButton>

	<StudyButton type="submit">Submit form</StudyButton>

	<StudyButton pending {onclick}>Pending action</StudyButton>

	<StudyButton disabled {onclick}>Disabled action</StudyButton>
</form>

<StudyField
	label="Farm name"
	description="Imported farm."
	error="Enter a name."
>
	{#snippet children(props)}
		<input class="study-input" {...props} />
	{/snippet}
</StudyField>

<StudyField label="Farmer name">
	{#snippet children(props)}
		<input class="study-input" {...props} />
	{/snippet}
</StudyField>

<StudyTabs
	label="Inventory source"
	bind:value
	items={[
		{ value: "backpack", label: "Backpack", content: backpack },
		{ value: "chests", label: "Chests", content: chests },
		{ value: "equipment", label: "Equipment", content: chests, disabled: true },
	]}
/>

{#snippet backpack()}
	<!-- An uncontrolled native value proves retention of the actual panel DOM,
	     rather than reconstruction from state held outside the tab. -->
	<label>
		Draft note <input value="Initial note" />
	</label>
{/snippet}

{#snippet chests()}
	<p>Chest contents</p>
{/snippet}

<StudyAlert title="Static notice" tone="warning">
	<p>A visible warning.</p>
</StudyAlert>

<StudyAlert title="Dynamic failure" tone="danger" live="assertive">
	<p>Try again.</p>
</StudyAlert>
