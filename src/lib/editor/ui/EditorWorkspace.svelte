<script lang="ts">
	// Native action controls need their base styles even when no legacy UI
	// component has been loaded in this session. Theme rules refine these tokens.
	import "../../ui/controls.css";
	import { Result } from "effect";
	import { untrack } from "svelte";
	import { formatDate } from "../../calendar.ts";
	import type { CommandResult } from "../command-result.ts";
	import CommandToasts from "./CommandToasts.svelte";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createRuneDraft } from "../field.svelte.ts";
	import EditorShell from "../../ui/frame/EditorShell.svelte";
	import SectionLink from "../../ui/frame/SectionLink.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	import CalendarPanel from "./CalendarPanel.svelte";
	import RelationshipPanel from "./RelationshipPanel.svelte";
	import QuestJournalPanel from "./QuestJournalPanel.svelte";
	import QiOrdersPanel from "./QiOrdersPanel.svelte";
	import EventsPanel from "./EventsPanel.svelte";
	import RecipesPanel from "./RecipesPanel.svelte";
	import CharacterPanel from "./CharacterPanel.svelte";
	import FarmPanel from "./FarmPanel.svelte";
	import BundlePanel from "./BundlePanel.svelte";
	import ReviewPanel from "./ReviewPanel.svelte";
	import FarmerRosterPanel from "./FarmerRosterPanel.svelte";
	interface Props {
		includeProofs?: boolean;
		downloading?: boolean;
		model: EditorModel;
		filename: string;
		onclose: () => void;
		ondownload: () => Promise<
			undefined | CommandResult<unknown, { message: string }>
		>;
	}
	let {
		model,
		filename,
		onclose,
		ondownload,
		includeProofs = false,
		downloading = false,
	}: Props = $props();

	// Hooks subscribe through the nearest file provider. Keep the accessor object:
	// destructuring .current would capture a stale non-reactive value.
	const view = useAtomValue(() => model.atomBindings.view);
	// This keyed workspace mounts once per imported file. Capture only display
	// strings from its initial domain view so edits and farmer selection cannot
	// rewrite the identity used to recognize the original save.
	const importedIdentity = untrack(() => {
		const initial = view.current;
		if (!initial) return undefined;
		return {
			farm: initial.farm.name || "Unnamed",
			farmer: initial.farmerChoices[0]?.name || "Unnamed farmer",
			date: formatDate(initial.calendar.date),
		};
	});
	// The workspace owns the draft across section navigation. Keeping its panels
	// mounted preserves input and lets external revisions mark conflicts visibly.
	const dateDraft = createRuneDraft(() => model.dateField);
	// Desktop links and the compact phone picker share one section inventory.
	// Proof-only sections remain available only in the comparison workspace.
	const sections = [
		{ id: "inventory", label: "Inventory", icon: "inventory" },
		{ id: "buildings", label: "Buildings & animals", icon: "buildings" },
		{ id: "community", label: "Community Center & Joja", icon: "community" },
		{ id: "farmers", label: "Farmhands", icon: "farmhands" },
		{ id: "storage", label: "Storage", icon: "chests" },
		{ id: "character", label: "Character", icon: "character" },
		{ id: "relationships", label: "Relationships", icon: "relationships" },
		{ id: "quests", label: "Quest journal", icon: "quests" },
		{ id: "qi", label: "Qi orders", icon: "qi" },
		{ id: "events", label: "Events", icon: "events" },
		{ id: "recipes", label: "Recipes", icon: "cooking" },
		{ id: "farm", label: "Farm settings", icon: "farm" },
		{ id: "calendar", label: "Date and weather", icon: "calendar" },
		{ id: "review", label: "Review changes", icon: "review" },
	] satisfies {
		id: string;
		label: string;
		icon: import("../../ui/studyIcons").StudyIconName;
	}[];
	const navigationSections = $derived(
		includeProofs
			? [
					...sections,
					{ id: "bundles", label: "Bundles", icon: "community" as const },
				]
			: sections,
	);
	const sectionPickerId = $props.id();
	let tab = $state("calendar");
	let inventoryOpened = $state(false);
	// Large editors subscribe only after their first visit. Once opened, retain
	// them so navigating away preserves local input and selection state.
	let characterOpened = $state(false);
	let relationshipsOpened = $state(false);
	let recipesOpened = $state(false);
	let eventsOpened = $state(false);
	let questsOpened = $state(false);
	let qiOpened = $state(false);
	let buildingsOpened = $state(false);
	let rosterOpened = $state(false);
	let communityOpened = $state(false);
	let storageOpened = $state(false);
	function chooseSection(section: string) {
		// Hidden panels retain their local state, so navigation explicitly finishes
		// any field gesture even when no native blur event accompanies the change.
		void model.edits.endActive();
		if (section === "inventory") inventoryOpened = true;
		if (section === "character") characterOpened = true;
		if (section === "relationships") relationshipsOpened = true;
		if (section === "recipes") recipesOpened = true;
		if (section === "events") eventsOpened = true;
		if (section === "quests") questsOpened = true;
		if (section === "qi") qiOpened = true;
		if (section === "buildings") buildingsOpened = true;
		if (section === "farmers") rosterOpened = true;
		if (section === "community") communityOpened = true;
		if (section === "storage") storageOpened = true;
		tab = section;
	}
	let error = $state("");
	async function perform(
		action: () => Promise<
			undefined | CommandResult<unknown, { message: string }>
		>,
	) {
		error = "";
		const result = await action();
		if (result && Result.isFailure(result)) error = result.failure.message;
	}
</script>

<div class="editor study-theme">
	<CommandToasts {model} />
	<EditorShell {onclose}>
		{#snippet header()}
			<header class="toolbar">
				<div class="save-heading">
					<strong>Stardew Save Editor</strong>

					<!-- Wrap identity parts independently on phones; retain the source
					     filename as secondary text rather than another toolbar control. -->
					{#if importedIdentity}
						<div class="save-identity" role="group" aria-label="Imported save">
							<span>{importedIdentity.farm} Farm</span>

							<span>{importedIdentity.farmer}</span>

							<span>{importedIdentity.date}</span>
						</div>
					{/if}

					<div class="source-file" title={filename}>{filename}</div>
				</div>
				<!-- Export joins the command queue after a field's blur commit;
					     disabling it during that commit would swallow the same click. -->
				<button
					type="button"
					class="study-button study-button--constructive study-button--filled export"
					disabled={downloading || dateDraft.current.dirty}
					aria-busy={downloading}
					aria-label="Export save"
					onclick={() => void perform(ondownload)}
				>
					<StudyIcon name="save" size={22} />

					{downloading ? "Exporting…" : "Export save"}
				</button>
			</header>
		{/snippet}
		{#snippet navigation()}
			<div class="navigation-content">
				<nav aria-label="Editor sections" class="section-links">
					{#each navigationSections as section (section.id)}
						<SectionLink
							href={`#${section.id}`}
							label={section.label}
							icon={section.icon}
							active={tab === section.id}
							onclick={() => chooseSection(section.id)}
						/>
					{/each}
				</nav>

				<div class="section-picker">
					<label for={sectionPickerId}>
						<StudyIcon
							name={navigationSections.find((section) => section.id === tab)
								?.icon ?? "inventory"}
							size={24}
						/>

						Section
					</label>

					<select
						id={sectionPickerId}
						class="ui-control"
						value={tab}
						onchange={(event) => chooseSection(event.currentTarget.value)}
					>
						{#each navigationSections as section (section.id)}
							<option value={section.id}>
								{section.label}
							</option>
						{/each}
					</select>
				</div>

				<!-- History belongs to editing, away from file export. Keep these targets
			     enabled through blur commits so the same click queues after the edit. -->
				<div class="history" role="group" aria-label="Edit history">
					<span class="history-label">History</span>

					<div class="history-buttons">
						<button
							type="button"
							class="study-button"
							disabled={!view.current?.canUndo}
							onclick={() => void perform(model.commands.undo)}
						>
							<StudyIcon name="undo" size={20} />

							Undo
						</button>

						<button
							type="button"
							class="study-button"
							disabled={!view.current?.canRedo}
							onclick={() => void perform(model.commands.redo)}
						>
							<StudyIcon name="redo" size={20} />

							Redo
						</button>
					</div>
				</div>
			</div>
		{/snippet}
		{#if error}
			<p role="alert">{error}</p>
		{/if}
		{#if dateDraft.current.dirty}
			<p role="status">Apply or reload your date draft before exporting.</p>
		{/if}
		<!-- Load inventory code/catalog only when this section first opens; visible
		     sprites then request their sheets. This boundary can also load locale data
		     in future. Keep the consumer mounted so selection survives navigation. -->
		{#if inventoryOpened}
			<div hidden={tab !== "inventory"}>
				{#await import("./BackpackPanel.svelte")}
					<p role="status">Loading inventory…</p>
				{:then panel}
					<panel.default {model} />
				{:catch}
					<p role="alert">
						The inventory view could not be loaded. Reopen the editor to try
						again.
					</p>
				{/await}
			</div>
		{/if}
		{#if buildingsOpened}
			<div hidden={tab !== "buildings"}>
				{#await import("./BuildingsPanel.svelte")}
					<p role="status">Loading buildings…</p>
				{:then panel}
					<panel.default {model} />
				{:catch}
					<p role="alert">
						The buildings view could not be loaded. Reopen the editor to try
						again.
					</p>
				{/await}
			</div>
		{/if}

		{#if rosterOpened && view.current}
			<div hidden={tab !== "farmers"}>
				<FarmerRosterPanel
					{model}
					roster={view.current.farmerRoster}
					appearances={view.current.appearances}
				/>
			</div>
		{/if}
		{#if communityOpened}
			<div hidden={tab !== "community"}>
				{#await import("./CommunityPanel.svelte")}
					<p role="status">Loading Community Center…</p>
				{:then panel}
					<panel.default {model} />
				{:catch}
					<p role="alert">
						The Community Center view could not be loaded. Reopen the editor to
						try again.
					</p>
				{/await}
			</div>
		{/if}

		{#if storageOpened}
			<div hidden={tab !== "storage"}>
				{#await import("./StoragePanel.svelte")}
					<p role="status">Loading storage…</p>
				{:then panel}
					<panel.default {model} />
				{:catch}
					<p role="alert">
						The storage view could not be loaded. Reopen the editor to try
						again.
					</p>
				{/await}
			</div>
		{/if}

		{#if characterOpened}
			<div hidden={tab !== "character"}>
				<CharacterPanel
					{model}
					oninventory={() => chooseSection("inventory")}
				/>
			</div>
		{/if}
		{#if relationshipsOpened}
			<div hidden={tab !== "relationships"}>
				<RelationshipPanel {model} />
			</div>
		{/if}
		{#if recipesOpened}
			<div hidden={tab !== "recipes"}>
				<RecipesPanel {model} />
			</div>
		{/if}
		{#if eventsOpened}
			<div hidden={tab !== "events"}>
				<EventsPanel {model} />
			</div>
		{/if}
		{#if questsOpened}
			<div hidden={tab !== "quests"}>
				<QuestJournalPanel {model} />
			</div>
		{/if}
		{#if qiOpened}
			<div hidden={tab !== "qi"}>
				<QiOrdersPanel {model} />
			</div>
		{/if}
		<div hidden={tab !== "farm"}><FarmPanel {model} /></div>
		<div hidden={tab !== "calendar"}>
			<CalendarPanel {model} draft={dateDraft} />
		</div>
		{#if includeProofs}
			<div hidden={tab !== "bundles"}>
				<BundlePanel {model} />
			</div>
		{/if}
		<div hidden={tab !== "review"}>
			<ReviewPanel {model} {includeProofs} active={tab === "review"} />
		</div>
	</EditorShell>
</div>

<style>
	.section-picker {
		display: none;
	}

	.editor {
		width: min(1440px, 100%);
		margin: auto;
		--study-frame-height: calc(100dvh - 16px);
	}
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px 24px;
		min-height: 96px;
		padding: 16px 48px 16px 20px;
	}
	.toolbar strong {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 24px;
		line-height: 1.15;
	}
	.save-heading {
		flex: 1 1 340px;
		min-width: 0;
	}
	.save-identity {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 14px;
		font-size: 17px;
		line-height: 1.35;
		margin-top: 8px;
		overflow-wrap: anywhere;
	}
	.source-file {
		font-size: 14px;
		color: #694621;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-top: 2px;
	}
	.export {
		flex: none;
		min-width: 144px;
	}
	.navigation-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.section-links {
		/* Sections scroll independently so History never covers the last link
		   and remains reachable in short desktop windows. */
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-color: #a36a35 #542710;
	}
	.history {
		flex: none;
		margin-top: auto;
		padding: 12px 9px;
		border-top: 1px solid #a36a35;
		background: #542710;
		color: #ffedc9;
	}
	.history-label {
		display: block;
		font-size: 16px;
		margin-bottom: 8px;
	}
	.history-buttons {
		display: flex;
		gap: 8px;
	}
	.history-buttons button {
		flex: 1;
		min-width: 0;
		padding-inline: 8px;
		font-size: 20px;
	}
	[role="alert"] {
		color: #8a1c19;
	}
	@media (max-width: 900px) {
		.editor {
			--study-frame-height: auto;
		}
		.navigation-content {
			height: auto;
		}
		.section-links {
			/* Fifteen wrapping tabs displaced the actual editor on phones. The
			   native picker keeps every full section name in one keyboard/touch control. */
			display: none;
		}
		.section-picker {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			gap: 12px;
			padding: 8px 12px;
			color: #ffedc9;
		}
		.section-picker label {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 18px;
		}
		.history {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 8px 12px;
			margin-top: 0;
		}
		.history-label {
			margin: 0 auto 0 0;
		}
		.history-buttons button {
			min-width: 84px;
			font-size: 18px;
		}
		.section-picker select {
			width: 100%;
			min-width: 0;
		}
	}
	@media (max-width: 600px) {
		/* Compact phone typography leaves room for the section picker and editor. */
		.editor {
			font-size: 18px;
			line-height: 1.3;
		}
		.toolbar {
			min-height: 0;
			padding: 12px 40px 12px 12px;
			gap: 8px;
		}
		.toolbar strong {
			font-size: 20px;
			line-height: 1.15;
		}
		.export {
			min-height: 44px;
			font-size: 18px;
			min-width: 0;
		}
		.editor :global(.content) {
			/* Retain the pane's safe top inset: its decorative rim overlays the
			   first 24px, including headings with no default top margin. */
			padding: 30px 20px 20px;
		}
		.editor :global(h1) {
			font-size: 27px;
			margin: 0 0 12px;
		}
		.editor :global(h2) {
			font-size: 22px;
		}
		.editor :global(h3) {
			font-size: 20px;
		}
	}
</style>
