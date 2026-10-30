<script lang="ts">
	// Native action controls need their base styles even when no legacy UI
	// component has been loaded in this session. Theme rules refine these tokens.
	import "../../ui/controls.css";
	import { Result } from "effect";
	import type { CommandResult } from "../command-result.ts";
	import CommandToasts from "./CommandToasts.svelte";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createRuneDraft } from "../field.svelte.ts";
	import EditorShell from "../../ui/frame/EditorShell.svelte";
	import SectionLink from "../../ui/frame/SectionLink.svelte";
	import CalendarPanel from "./CalendarPanel.svelte";
	import RelationshipPanel from "./RelationshipPanel.svelte";
	import AppearancePanel from "./AppearancePanel.svelte";
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
	// The workspace owns the draft across section navigation. Keeping its panels
	// mounted preserves input and lets external revisions mark conflicts visibly.
	const dateDraft = createRuneDraft(() => model.dateField);
	// Desktop links and the compact phone picker share one section inventory.
	// Proof-only sections remain available only in the comparison workspace.
	const sections = [
		{ id: "inventory", label: "Inventory", icon: "inventory" },
		{ id: "buildings", label: "Buildings & animals", icon: "farm" },
		{ id: "community", label: "Community Center & Joja", icon: "community" },
		{ id: "farmers", label: "Farmhands", icon: "character" },
		{ id: "storage", label: "Storage", icon: "inventory" },
		{ id: "character", label: "Character", icon: "character" },
		{ id: "appearance", label: "Appearance", icon: "character" },
		{ id: "relationships", label: "Relationships", icon: "character" },
		{ id: "quests", label: "Quest journal", icon: "quests" },
		{ id: "qi", label: "Qi orders", icon: "quests" },
		{ id: "events", label: "Events", icon: "events" },
		{ id: "recipes", label: "Recipes", icon: "cooking" },
		{ id: "farm", label: "Farm settings", icon: "farm" },
		{ id: "calendar", label: "Date and weather", icon: "farm" },
		{ id: "review", label: "Review changes", icon: "quests" },
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
	let appearanceOpened = $state(false);
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
		if (section === "appearance") appearanceOpened = true;
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
				<strong>Stardew Save Editor - V2</strong>
				<span>{filename}</span>
				<!-- History commands queue after a field's blur commit, preserving
				     the same click rather than disabling its target mid-gesture. -->
				<div class="buttons">
					<button
						type="button"
						disabled={!view.current?.canUndo}
						onclick={() => void perform(model.commands.undo)}
					>
						Undo
					</button>
					<button
						type="button"
						disabled={!view.current?.canRedo}
						onclick={() => void perform(model.commands.redo)}
					>
						Redo
					</button>
					<!-- Export joins the command queue after a field's blur commit;
					     disabling it during that commit would swallow the same click. -->
					<button
						type="button"
						class="export"
						disabled={downloading || dateDraft.current.dirty}
						aria-busy={downloading}
						aria-label="Export save"
						onclick={() => void perform(ondownload)}
					>
						{downloading ? "Exporting…" : "Export save"}
					</button>
				</div>
			</header>
		{/snippet}
		{#snippet navigation()}
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
				<label for={sectionPickerId}>Section</label>

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
				<FarmerRosterPanel {model} roster={view.current.farmerRoster} />
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
			<div hidden={tab !== "character"}><CharacterPanel {model} /></div>
		{/if}
		{#if appearanceOpened}
			<div hidden={tab !== "appearance"}>
				<AppearancePanel {model} />
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
		<div hidden={tab !== "review"}><ReviewPanel {model} {includeProofs} /></div>
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
		gap: 12px;
		min-height: 72px;
		padding: 12px 42px 12px 16px;
	}
	.toolbar strong {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 23px;
		margin-right: auto;
	}
	.toolbar span {
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.buttons {
		display: flex;
		gap: 8px;
	}
	button {
		font: inherit;
		min-height: 40px;
		padding: 5px 10px;
		cursor: pointer;
		color: #351b0e;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.export {
		background: #248448;
		color: #fff6dc;
		border: 2px solid #24522a;
	}
	[role="alert"] {
		color: #8a1c19;
	}
	@media (max-width: 900px) {
		.editor {
			--study-frame-height: auto;
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
		.section-picker select {
			width: 100%;
			min-width: 0;
		}
		.toolbar strong {
			flex-basis: 100%;
		}
		.toolbar span {
			display: none;
		}
	}
	@media (max-width: 600px) {
		/* Keep the inventory overview in reach: phone chrome uses compact
		   wrapping tabs so added sections remain reachable without clipped labels. */
		.editor {
			font-size: 18px;
			line-height: 1.3;
		}
		.toolbar {
			min-height: 0;
			padding: 8px 42px 8px 10px;
			gap: 8px;
		}
		.toolbar strong {
			font-size: 18px;
			line-height: 1.15;
		}
		.buttons {
			gap: 6px;
		}
		.buttons button {
			min-height: 36px;
			padding: 4px 9px;
			font-size: 17px;
		}
		.editor :global(.content) {
			/* Keep text inside the parchment rim while reducing vertical chrome. */
			padding: 12px 20px;
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
