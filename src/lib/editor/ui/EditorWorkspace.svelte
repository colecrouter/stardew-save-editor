<script lang="ts">
	import { SvelteSet } from "svelte/reactivity";

	import { afterNavigate, onNavigate } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";

	import AppMark from "../../ui/AppMark.svelte";
	// Native action controls need their base styles even when no legacy UI
	// component has been loaded in this session. Theme rules refine these tokens.
	import "../../ui/controls.css";
	// Keep component dependencies after base controls; EditorApp applies the theme
	// after loading this workspace. This partition preserves stylesheet registration.
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import { onMount, type Snippet, untrack } from "svelte";

	import { formatDate } from "../../calendar.ts";
	import EditorShell from "../../ui/frame/EditorShell.svelte";
	import SectionLink from "../../ui/frame/SectionLink.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	import type { CommandResult } from "../command-result.ts";
	import type { EditorModel } from "../editor-model.ts";
	import { createRuneDraft } from "../field.svelte.ts";
	import { historyShortcut, usesAppleShortcuts } from "../history-shortcuts.ts";
	import {
		type EditorPanelPath,
		getPanelDrafts,
		setEditorPanel,
	} from "../panel-context.ts";
	import BundlePanel from "./BundlePanel.svelte";
	import CalendarPanel from "./CalendarPanel.svelte";
	import CharacterPanel from "./CharacterPanel.svelte";
	import CommandToasts from "./CommandToasts.svelte";
	import EventsPanel from "./EventsPanel.svelte";
	import FarmerRosterPanel from "./FarmerRosterPanel.svelte";
	import FarmPanel from "./FarmPanel.svelte";
	import LocationInspector from "./LocationInspector.svelte";
	import PetsPanel from "./PetsPanel.svelte";
	import ProgressPanel from "./ProgressPanel.svelte";
	import QiOrdersPanel from "./QiOrdersPanel.svelte";
	import QuestJournalPanel from "./QuestJournalPanel.svelte";
	import RecipesPanel from "./RecipesPanel.svelte";
	import ReconstructionPanel from "./ReconstructionPanel.svelte";
	import RelationshipPanel from "./RelationshipPanel.svelte";
	import ReviewPanel from "./ReviewPanel.svelte";

	interface Props {
		includeProofs?: boolean;
		children?: Snippet;
		downloading?: boolean;
		downloadStatus?: string;
		downloadError?: string;
		offerDownloadCopy?: boolean;
		model: EditorModel;
		filename: string;
		onclose: () => void;
		ondismissdownloaderror?: () => void;
		ondownload: (
			mode?: "picker" | "download",
		) => Promise<undefined | CommandResult<unknown, { message: string }>>;
	}
	let {
		model,
		filename,
		onclose,
		ondismissdownloaderror,
		ondownload,
		includeProofs = false,
		children,
		downloading = false,
		downloadStatus = "Preparing save…",
		downloadError = "",
		offerDownloadCopy = false,
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
	// Routed panels follow Kit's active route. Standalone callers keep their
	// own selection and supply an explicit date draft to the Calendar panel.
	const routed = untrack(() => children !== undefined);
	const drafts = getPanelDrafts();
	let localSection = $state("calendar");
	const tab = $derived(
		routed ? (page.route.id?.slice("/editor/".length) ?? "") : localSection,
	);
	const sectionPickerId = $props.id();
	const dateDraft = routed ? undefined : createRuneDraft(() => model.dateField);
	const exportBlocked = $derived(
		drafts?.exportBlocked ?? dateDraft?.current.dirty ?? false,
	);
	// The guide links take the user away from its panel. Keep checkmarks with
	// this save so returning to the guide shows the steps already completed.
	setEditorPanel({
		reconstructionSteps: new SvelteSet<string>(),
		get model() {
			return model;
		},
	});

	let sectionsOpen = $state(false);
	let sectionsMenu = $state<HTMLDetailsElement>();
	let sectionsTrigger = $state<HTMLElement>();

	function revealCurrentSection(menu: HTMLDetailsElement) {
		if (!menu.open) return;
		const list = menu.querySelector(".section-menu-links");
		const current = list?.querySelector('[aria-current="page"]');
		if (!list || !current) return;
		const item = current.getBoundingClientRect();
		const viewport = list.getBoundingClientRect();
		// Scroll only the menu, so opening it never moves the editor viewport.
		if (item.top < viewport.top) list.scrollTop += item.top - viewport.top;
		else if (item.bottom > viewport.bottom)
			list.scrollTop += item.bottom - viewport.bottom;
	}

	function closeSections() {
		if (!sectionsOpen) return;
		// A focused link would disappear when the disclosure closes.
		if (sectionsMenu?.contains(document.activeElement))
			sectionsTrigger?.focus();
		sectionsOpen = false;
	}

	if (routed) {
		onNavigate(({ to, from }) => {
			// Navigation has passed the draft guard. Finish a field gesture
			// before Kit replaces the panel, even if it never receives blur.
			if (to?.route.id !== from?.route.id) void model.edits.endActive();
		});
		afterNavigate(closeSections);
	}

	function requestClose() {
		if (
			!drafts?.dirty ||
			window.confirm("Close the save and discard its unapplied changes?")
		)
			onclose();
	}

	function chooseSection(section: string) {
		void model.edits.endActive();
		localSection = section;
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
	// Resolve platform hints after hydration, without browser globals during SSR.
	let appleShortcuts = $state(false);
	onMount(() => {
		appleShortcuts = usesAppleShortcuts(navigator.platform);
	});
	const undoKeys = $derived(appleShortcuts ? "Meta+Z" : "Control+Z");
	const redoKeys = $derived(
		appleShortcuts ? "Meta+Shift+Z" : "Control+Y Control+Shift+Z",
	);
	function onHistoryKey(event: KeyboardEvent) {
		const action = historyShortcut(event, appleShortcuts, document);
		if (
			!action ||
			!(action === "undo" ? view.current?.canUndo : view.current?.canRedo)
		)
			return;
		// Consume only an available save-history command. The existing command
		// boundary serializes it with edits and reports expected errors/defects.
		event.preventDefault();
		void perform(action === "undo" ? model.commands.undo : model.commands.redo);
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (
			event.key === "Escape" &&
			sectionsOpen &&
			sectionsMenu?.contains(document.activeElement)
		) {
			event.preventDefault();
			closeSections();
		} else onHistoryKey(event);
	}}
/>

<div class="editor study-theme">
	<CommandToasts {model} />
	{#snippet sectionLinks(mode: "links" | "mobile" | "label" | "icon")}
		{#snippet sectionLink(
			id: string,
			label: string,
			icon: import("../../ui/studyIcons").StudyIconName,
		)}
			{#if mode === "label"}
				{#if tab === id}{label}{/if}
			{:else if mode === "icon"}
				{#if tab === id}
					<StudyIcon
						name={icon}
						size={24}
					/>
				{/if}
			{:else}
				<SectionLink
					href={routed ? resolve(`/editor/${id}` as EditorPanelPath) : `#${id}`}
					{label}
					{icon}
					active={tab === id}
					showCurrentMarker={mode === "mobile"}
					onclick={() => {
						if (!routed) chooseSection(id);
					}}
				/>
			{/if}
		{/snippet}

		{@render sectionLink("inventory", "Inventory", "inventory")}
		{@render sectionLink("pets", "Pets", "pets")}
		{@render sectionLink("buildings", "Buildings & animals", "buildings")}
		{@render sectionLink("community", "Community Center & Joja", "community")}
		{@render sectionLink("farmers", "Farmhands", "farmhands")}
		{@render sectionLink("storage", "Storage", "chests")}
		{@render sectionLink("character", "Character", "character")}
		{@render sectionLink("relationships", "Relationships", "relationships")}
		{@render sectionLink("quests", "Quest journal", "quests")}
		{@render sectionLink("qi", "Qi orders", "qi")}
		{@render sectionLink("events", "Events", "events")}
		{@render sectionLink("recipes", "Recipes", "cooking")}
		{@render sectionLink("progress", "Progress", "progress")}
		{@render sectionLink("farm", "Farm settings", "farm")}
		{@render sectionLink("calendar", "Date and weather", "calendar")}
		{@render sectionLink("reconstruct", "Rebuild lost progress", "rebuild")}
		{@render sectionLink("review", "Review changes", "review")}
		{#if includeProofs}
			{@render sectionLink("locations", "Locations", "locations")}
			{@render sectionLink("bundles", "Bundles", "community")}
		{/if}
	{/snippet}
	<EditorShell onclose={requestClose}>
		{#snippet header()}
			<header class="toolbar">
				<div class="save-heading">
					<div class="app-identity">
						<AppMark />

						<strong>Stardew Save Editor</strong>
					</div>

					<!-- Wrap identity parts independently on phones; retain the source
					     filename as secondary text rather than another toolbar control. -->
					{#if importedIdentity}
						<div
							class="save-identity"
							role="group"
							aria-label="Imported save"
						>
							<span>{importedIdentity.farm} Farm</span>

							<span>{importedIdentity.farmer}</span>

							<span>{importedIdentity.date}</span>
						</div>
					{/if}

					<div
						class="source-file"
						title={filename}
					>
						{filename}
					</div>
				</div>
				<!-- Export joins the command queue after a field's blur commit;
					     disabling it during that commit would swallow the same click. -->
				<button
					type="button"
					class="study-button study-button--constructive study-button--filled export"
					disabled={downloading || exportBlocked}
					aria-busy={downloading}
					aria-label="Export save"
					onclick={() => void perform(ondownload)}
				>
					<StudyIcon
						name="save"
						size={22}
					/>

					{downloading ? "Exporting…" : "Export save"}
				</button>
				<!-- Announce the active phase without changing the button's stable name.
				     The pending button prevents duplicate exports; Exit stays usable. -->
				{#if downloading}
					<span role="status">{downloadStatus}</span>
				{/if}
			</header>
		{/snippet}
		{#snippet navigation()}
			<div class="navigation-content">
				<nav
					aria-label="Editor sections"
					class="section-links"
					data-sveltekit-reset={routed ? "false" : undefined}
				>
					{@render sectionLinks("links")}
				</nav>

				{#if routed}
					<!-- A disclosure keeps the section list out of the way until
					     opened. Only a completed navigation closes it. -->
					<details
						class="section-menu"
						bind:open={sectionsOpen}
						bind:this={sectionsMenu}
						ontoggle={(event) => revealCurrentSection(event.currentTarget)}
					>
						<summary bind:this={sectionsTrigger}>
							<span class="section-menu-label">Sections</span>

							<span class="section-menu-current">
								{@render sectionLinks("label")}
							</span>
						</summary>

						<nav
							class="section-menu-links"
							aria-label="Editor sections"
							data-sveltekit-reset="false"
						>
							{@render sectionLinks("mobile")}
						</nav>
					</details>
				{:else}
					<div class="section-picker">
						<label for={sectionPickerId}>
							{@render sectionLinks("icon")}

							Section
						</label>

						<select
							id={sectionPickerId}
							class="ui-control"
							value={tab}
							onchange={(event) => chooseSection(event.currentTarget.value)}
						>
							<option value="inventory">Inventory</option>
							<option value="pets">Pets</option>
							<option value="buildings">Buildings &amp; animals</option>
							<option value="community">Community Center &amp; Joja</option>
							<option value="farmers">Farmhands</option>
							<option value="storage">Storage</option>
							<option value="character">Character</option>
							<option value="relationships">Relationships</option>
							<option value="quests">Quest journal</option>
							<option value="qi">Qi orders</option>
							<option value="events">Events</option>
							<option value="recipes">Recipes</option>
							<option value="progress">Progress</option>
							<option value="farm">Farm settings</option>
							<option value="calendar">Date and weather</option>
							<option value="reconstruct">Rebuild lost progress</option>
							<option value="review">Review changes</option>
							{#if includeProofs}
								<option value="locations">Locations</option>
								<option value="bundles">Bundles</option>
							{/if}
						</select>
					</div>
				{/if}

				<!-- History belongs to editing, away from file export. Keep these targets
			     enabled through blur commits so the same click queues after the edit. -->
				<div
					class="history"
					role="group"
					aria-label="Edit history"
				>
					<span class="history-label">History</span>

					<div class="history-buttons">
						<button
							type="button"
							class="study-button"
							title={appleShortcuts ? "Undo (⌘Z)" : "Undo (Ctrl+Z)"}
							aria-keyshortcuts={undoKeys}
							disabled={!view.current?.canUndo}
							onclick={() => void perform(model.commands.undo)}
						>
							<StudyIcon
								name="undo"
								size={20}
							/>

							Undo
						</button>

						<button
							type="button"
							class="study-button"
							title={appleShortcuts
								? "Redo (⇧⌘Z)"
								: "Redo (Ctrl+Y or Ctrl+Shift+Z)"}
							aria-keyshortcuts={redoKeys}
							disabled={!view.current?.canRedo}
							onclick={() => void perform(model.commands.redo)}
						>
							<StudyIcon
								name="redo"
								size={20}
							/>

							Redo
						</button>
					</div>
				</div>
			</div>
		{/snippet}
		{#if error}
			<p role="alert">{error}</p>
		{/if}
		{#if children}
			<div class:inventory-section={tab === "inventory"}>
				{@render children()}
			</div>
		{:else}
			{#if tab === "inventory"}
				<div class="inventory-section">
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
			{#if tab === "buildings"}
				<div>
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

			{#if tab === "farmers" && view.current}
				<div>
					<FarmerRosterPanel
						{model}
						roster={view.current.farmerRoster}
						appearances={view.current.appearances}
					/>
				</div>
			{/if}
			{#if tab === "community"}
				<div>
					{#await import("./CommunityPanel.svelte")}
						<p role="status">Loading Community Center…</p>
					{:then panel}
						<panel.default {model} />
					{:catch}
						<p role="alert">
							The Community Center view could not be loaded. Reopen the editor
							to try again.
						</p>
					{/await}
				</div>
			{/if}

			{#if tab === "storage"}
				<div>
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

			{#if tab === "character"}
				<div>
					<CharacterPanel
						{model}
						oninventory={() => chooseSection("inventory")}
					/>
				</div>
			{/if}
			{#if tab === "relationships"}
				<div>
					<RelationshipPanel {model} />
				</div>
			{/if}
			{#if tab === "progress"}
				<div>
					<ProgressPanel
						{model}
						onsection={chooseSection}
					/>
				</div>
			{/if}
			{#if tab === "recipes"}
				<div>
					<RecipesPanel {model} />
				</div>
			{/if}
			{#if tab === "events"}
				<div>
					<EventsPanel {model} />
				</div>
			{/if}
			{#if tab === "quests"}
				<div>
					<QuestJournalPanel {model} />
				</div>
			{/if}
			{#if tab === "qi"}
				<div>
					<QiOrdersPanel {model} />
				</div>
			{/if}
			{#if tab === "pets"}
				<div>
					<PetsPanel {model} />
				</div>
			{/if}
			{#if tab === "farm"}<div><FarmPanel {model} /></div>{/if}
			{#if tab === "calendar" && dateDraft}<div>
					<CalendarPanel
						{model}
						draft={dateDraft}
					/>
				</div>{/if}

			{#if includeProofs && tab === "locations"}
				<LocationInspector {model} />
			{/if}

			{#if tab === "reconstruct"}
				<div>
					<ReconstructionPanel onsection={chooseSection} />
				</div>
			{/if}
			{#if includeProofs && tab === "bundles"}
				<div>
					<BundlePanel {model} />
				</div>
			{/if}
			{#if tab === "review"}<div>
					<ReviewPanel
						{model}
						{includeProofs}
						active={tab === "review"}
					/>
				</div>{/if}
		{/if}
	</EditorShell>

	{#if downloadError}
		<!-- Keep recovery in the workspace so it follows the active save. The
		     fixed toast leaves the toolbar and editor layout in place. -->
		<section
			class="export-recovery"
			aria-label="Export recovery"
		>
			<p role="alert">
				{downloadError} Your edits are still open.
			</p>

			<div class="export-recovery-actions">
				<button
					type="button"
					class="study-button"
					disabled={downloading || exportBlocked}
					onclick={() => void perform(ondownload)}
				>
					Try exporting again
				</button>

				{#if offerDownloadCopy}
					<button
						type="button"
						class="study-button study-button--constructive study-button--filled"
						disabled={downloading || exportBlocked}
						onclick={() => void ondownload("download")}
					>
						Download a copy
					</button>
				{/if}
				{#if ondismissdownloaderror}
					<!-- Let users uncover editor controls while they correct the save. -->
					<button
						type="button"
						class="study-button"
						onclick={ondismissdownloaderror}
					>
						Dismiss
					</button>
				{/if}
			</div>
		</section>
	{/if}
</div>

<style>
	/* The desktop workbench receives the parchment's available content height;
       item-specific details must scroll within it rather than resize the page. */
	@media (min-width: 1151px) {
		.inventory-section {
			height: 100%;
			min-height: 0;
		}
	}
	.section-menu,
	.section-picker {
		display: none;
	}

	.editor {
		width: min(1440px, 100%);
		margin: auto;
		/* The app has already reserved outer spacing and credits. Fill only its remainder. */
		--study-frame-height: 100%;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
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
	.app-identity {
		/* Keep the compact mark beside the name while allowing the name itself
		   to wrap on phones; the save identity remains on its own line below. */
		display: flex;
		align-items: center;
		gap: 10px;
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
	.export-recovery {
		/* Reserve a gutter on narrow screens and float over the editor content. */
		position: fixed;
		z-index: 20;
		inset-inline-end: 16px;
		bottom: max(16px, env(safe-area-inset-bottom));
		inline-size: min(380px, calc(100% - 32px));
		padding: 12px;
		border: 2px solid #a36a35;
		border-radius: 8px;
		background: #fff0ce;
		box-shadow: 0 4px 16px #54271055;
		font-size: 16px;
	}
	.export-recovery-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}
	.export-recovery p {
		margin: 0;
		color: #8a1c19;
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
		.section-menu {
			display: block;
			color: #ffedc9;
			padding: 6px 12px;
		}
		.section-menu summary {
			cursor: pointer;
			min-height: 44px;
			padding: 9px 10px;
			border: 1px solid #a36a35;
			border-radius: 4px;
			background: #663616;
		}
		.section-menu summary:focus-visible {
			outline: 2px solid #ffedc9;
			outline-offset: 2px;
		}
		.section-menu-current {
			margin-inline-start: 8px;
			font-weight: bold;
		}
		.section-menu-links {
			/* Keep the menu usable in landscape and leave editor content below. */
			max-height: min(40vh, 320px);
			overflow-y: auto;
			overscroll-behavior: contain;
			margin-top: 4px;
			border: 1px solid #a36a35;
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
