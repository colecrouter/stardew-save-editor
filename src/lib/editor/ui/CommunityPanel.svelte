<script lang="ts">
	import { untrack } from "svelte";
	import { useAtomValue } from "effect-atom-svelte";
	import { Result } from "effect";
	import type { EditorModel } from "../editor-model.ts";
	import { createCommunityDomain } from "../community-domain.ts";
	import CommunityBundleCard from "./CommunityBundleCard.svelte";
	import JojaProjectBoard from "./JojaProjectBoard.svelte";
	import StudyTabs from "../../ui/kit/StudyTabs.svelte";
	import StudyDialog from "../../ui/kit/StudyDialog.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const domain = $derived(
		view.current
			? createCommunityDomain(model, view.current.community)
			: undefined,
	);
	let selectedRoom = $state(1);
	const room = $derived(
		domain?.rooms.find((row) => row.id === selectedRoom) ?? domain?.rooms[0],
	);
	const bundles = $derived(
		domain?.bundles.filter((row) => row.room === room?.id) ?? [],
	);

	// Tabs are viewing state, not a second membership setter. Only a committed
	// membership transition (including Undo/Redo) reveals the corresponding route;
	// ordinary donations must not reset a manually chosen tab or room.
	let membershipSeen = untrack(() => view.current?.community.membership);
	let route = $state(membershipSeen === true ? "joja" : "center");
	$effect(() => {
		const membership = domain?.membership;
		if (membership !== membershipSeen) {
			membershipSeen = membership;
			route = membership === true ? "joja" : "center";
		}
	});

	let membershipOpen = $state(false);
	let desiredMembership = $state(false);
	let membershipRevision: number | undefined;
	let membershipBusy = $state(false);
	let membershipError = $state("");
	function showMembership(open: boolean) {
		if (open) {
			// Freeze both intent and revision when confirmation opens. A later edit
			// must reject this preview rather than silently reverse a different route.
			desiredMembership = domain?.membership === false;
			membershipRevision = view.current?.revision;
			membershipError = "";
		}
		membershipOpen = open;
	}
	async function changeMembership() {
		const target = domain;
		if (!target || membershipBusy) return;
		membershipBusy = true;
		membershipError = "";
		try {
			const result = await target.membershipChange(
				desiredMembership,
				membershipRevision,
			);
			// Noncompletion already reached the shared defect/cancellation boundary.
			// Expected failures stay in the open dialog so the user can retry or cancel.
			if (!result) return;
			if (Result.isFailure(result)) membershipError = result.failure.message;
			else membershipOpen = false;
		} finally {
			membershipBusy = false;
		}
	}
</script>

<div class="community-heading">
	<div>
		<h1>Community Center &amp; Joja</h1>

		<p class="route-status">
			Current route: <strong>
				{domain?.membership === true
					? "Joja membership"
					: domain?.membership === false
						? "Community Center"
						: "Membership unavailable"}
			</strong>
		</p>
	</div>

	{#if domain?.supported}
		<StudyDialog
			trigger={domain.membership ? "Leave Joja" : "Enable Joja"}
			title={desiredMembership
				? "Enable Joja membership?"
				: "Leave Joja membership?"}
			description="Changes membership for all farmers and updates the route-specific restoration progress. Existing donations and unclaimed rewards are retained."
			bind:open={() => membershipOpen, showMembership}
			dismissible={!membershipBusy}
			disabled={domain.membership === undefined}
		>
			<StudyAside title="A change of route">
				<p>
					Completed rooms keep their restoration benefits. This edit does not
					spend gold or remove items.
				</p>
			</StudyAside>

			{#if membershipError}
				<StudyAlert
					title="Membership could not be changed"
					tone="danger"
					live="assertive"
				>
					<p>{membershipError}</p>
				</StudyAlert>
			{/if}

			{#snippet actions(close)}
				<StudyButton onclick={close} disabled={membershipBusy}>
					Cancel
				</StudyButton>

				<StudyButton
					intent={desiredMembership ? "constructive" : "destructive"}
					variant="filled"
					pending={membershipBusy}
					onclick={() => void changeMembership()}
				>
					{desiredMembership ? "Enable Joja" : "Leave Joja"}
				</StudyButton>
			{/snippet}
		</StudyDialog>
	{/if}
</div>

{#if !domain?.supported}
	<StudyAlert title="Community Center unavailable" tone="warning">
		<p>{domain?.reason ?? "Community Center data is unavailable."}</p>
	</StudyAlert>
{:else}
	<StudyTabs
		label="Community development route"
		bind:value={route}
		items={[
			{ value: "center", label: "Community Center", content: center },
			{ value: "joja", label: "Joja", content: joja },
		]}
	/>
{/if}

{#snippet center()}
	{#if domain}
		{#if domain.membership === true}
			<div class="route-notice">
				<StudyAlert title="Saved Community Center donations" tone="info">
					<p>
						Joja membership is active. These saved donations share restoration
						progress with Joja projects, so editing them can change those
						projects too. Membership stays unchanged, and no items are spent.
					</p>
				</StudyAlert>
			</div>
		{:else if domain.membership === undefined}
			<div class="route-notice">
				<StudyAlert title="Membership could not be read" tone="warning">
					<p>
						Saved donations are shown below. Membership changes and Joja
						projects are unavailable.
					</p>
				</StudyAlert>
			</div>
		{/if}

		<div class="room-layout">
			<nav aria-label="Community Center rooms" class="rooms">
				{#each domain.rooms as row (row.id)}
					<button
						type="button"
						class="room-choice"
						aria-pressed={room?.id === row.id}
						onclick={() => {
							selectedRoom = row.id;
						}}
					>
						<span class="room-name">{row.name}</span>

						<span class="room-state">
							{row.completed
								? "Donations complete"
								: row.completed === undefined
									? "No supported bundles"
									: "Donations in progress"}
						</span>
					</button>
				{/each}
			</nav>

			<section class="room" aria-label={room?.name}>
				<header class="room-heading">
					<div>
						<h2>{room?.name}</h2>

						<p>{room?.unlock}</p>
					</div>

					<StudyIcon name={room?.restored ? "check" : "community"} size={32} />
				</header>

				{#if room?.note}
					<p class="room-note">{room.note}</p>
				{/if}

				{#if !bundles.length}
					<StudyAside title="No saved bundles">
						<p>No saved bundles were found for this room.</p>
					</StudyAside>
				{/if}

				{#each bundles as bundle (bundle.key)}
					<CommunityBundleCard
						bundle={domain.bundle(bundle)}
						disabled={domain.membership === undefined}
					/>
				{/each}
			</section>
		</div>

		{#if domain.bundles.some((row) => row.room === undefined)}
			<details class="unsupported">
				<summary>Unsupported saved bundles</summary>

				{#each domain.bundles.filter((row) => row.room === undefined) as bundle (bundle.key)}
					<p>{bundle.name}: {bundle.reason}</p>
				{/each}
			</details>
		{/if}
	{/if}
{/snippet}

{#snippet joja()}
	{#if domain}
		<JojaProjectBoard community={domain} />
	{/if}
{/snippet}

<style>
	.community-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	h1 {
		font-size: 32px;
		margin: 0;
	}
	.route-status {
		margin: 8px 0 0;
		color: #694621;
		font-size: 18px;
	}
	.route-status strong {
		color: #311304;
		font-weight: 400;
	}
	.route-notice {
		margin-bottom: 20px;
	}
	.room-layout {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}
	.rooms {
		display: grid;
		gap: 6px;
	}
	.room-choice {
		display: grid;
		align-content: center;
		gap: 6px;
		width: 100%;
		min-height: 74px;
		padding: 12px;
		font: inherit;
		text-align: left;
		background: #f3cf96;
		color: #311304;
		border: 2px solid #b98b52;
		cursor: pointer;
	}
	.room-choice[aria-pressed="true"] {
		background: #fff2d3;
		border-color: #70401d;
		box-shadow: inset 3px 0 #b98b52;
	}
	.room-choice:focus-visible {
		outline: 3px solid #176fb4;
		outline-offset: 2px;
	}
	.room-name {
		font-size: 20px;
	}
	.room-state {
		font-size: 16px;
		color: #694621;
	}
	.room {
		display: grid;
		align-content: start;
		gap: 16px;
		min-width: 0;
	}
	.room-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding-bottom: 16px;
		border-bottom: 2px solid #b98b52;
		color: #285f30;
	}
	.room-heading h2 {
		font-size: 27px;
		margin: 0;
		color: #311304;
	}
	.room-heading p {
		margin: 8px 0 0;
		font-size: 19px;
		color: #694621;
	}
	.room-note {
		margin: 0;
		color: #694621;
		font-size: 18px;
		max-width: 65ch;
	}
	.unsupported {
		margin-top: 24px;
	}
	.unsupported summary {
		cursor: pointer;
		min-height: 44px;
		padding-block: 8px;
	}
	@media (max-width: 1050px) {
		.room-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.rooms {
			display: flex;
			overflow-x: auto;
			padding: 3px 3px 8px;
			scrollbar-color: #b98b52 #ffe2aa;
		}
		.room-choice {
			flex: 0 0 164px;
		}
	}
	@media (max-width: 600px) {
		h1 {
			font-size: 27px;
		}
		.room-layout {
			gap: 16px;
		}
		.room-heading h2 {
			font-size: 23px;
		}
	}
</style>
