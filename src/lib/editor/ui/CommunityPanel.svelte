<script lang="ts">
	import { untrack } from "svelte";
	import { useAtomValue } from "effect-atom-svelte";
	import { Result } from "effect";
	import type { EditorModel } from "../editor-model.ts";
	import { createCommunityDomain } from "../community-domain.ts";
	import CommunityBundleCard from "./CommunityBundleCard.svelte";
	import JojaProjectBoard from "./JojaProjectBoard.svelte";
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

	// Only the committed membership determines the visible route. Retained Center
	// donations are an explicit secondary disclosure, collapsed on route changes;
	// ordinary donation revisions preserve its state and the selected room.
	let membershipSeen = untrack(() => view.current?.community.membership);
	let retainedOpen = $state(false);
	$effect(() => {
		const membership = domain?.membership;
		if (membership !== membershipSeen) {
			membershipSeen = membership;
			retainedOpen = false;
		}
	});

	let membershipOpen = $state(false);
	let desiredMembership = $state(false);
	let membershipAtOpen = $state<boolean | undefined>();
	const routeChoiceId = $props.id();
	let membershipRevision: number | undefined;
	let membershipBusy = $state(false);
	let membershipError = $state("");
	let roomBusy = $state(false);
	let roomFeedback = $state<{ roomId: number; message: string }>();
	async function changeRoom(value: boolean) {
		const target = domain;
		const targetRoom = room;
		if (!target || !targetRoom || roomBusy) return;
		roomBusy = true;
		roomFeedback = undefined;
		try {
			const result = await target.roomProgress(targetRoom.id, value);
			// Room browsing may change while the queued action completes; feedback
			// remains attached to its original room, while history owns the data.
			if (result && Result.isFailure(result))
				roomFeedback = {
					roomId: targetRoom.id,
					message: result.failure.message,
				};
		} finally {
			roomBusy = false;
		}
	}
	function showMembership(open: boolean) {
		if (open) {
			// Capture the opening membership and revision; the desired route remains
			// editable in this dialog. Later edits must reject this stale preview.
			membershipAtOpen = domain?.membership;
			desiredMembership = membershipAtOpen ?? false;
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
	<h1>Community development</h1>

	<div class="route-control" role="group" aria-label="Restoration route">
		<p class="route-status">
			<span>Restoration route</span>
			<strong>
				{domain?.membership === true
					? "Joja membership"
					: domain?.membership === false
						? "Community Center"
						: "Membership unavailable"}
			</strong>
		</p>

		{#if domain?.supported}
			<StudyDialog
				trigger="Change route"
				title="Change restoration route"
				description="Choose how Pelican Town is restored. This changes membership for all farmers and updates the route-specific restoration progress. Existing donations and unclaimed rewards are retained."
				bind:open={() => membershipOpen, showMembership}
				dismissible={!membershipBusy}
				disabled={domain.membership === undefined}
			>
				<fieldset class="route-options" disabled={membershipBusy}>
					<legend>Restoration route</legend>

					<label>
						<input
							type="radio"
							name={routeChoiceId}
							value={false}
							bind:group={desiredMembership}
						/>
						Community Center
					</label>

					<label>
						<input
							type="radio"
							name={routeChoiceId}
							value={true}
							bind:group={desiredMembership}
						/>
						Joja membership
					</label>
				</fieldset>

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
						intent="constructive"
						variant="filled"
						pending={membershipBusy}
						disabled={desiredMembership === membershipAtOpen}
						onclick={() => void changeMembership()}
					>
						{desiredMembership
							? "Switch to Joja"
							: "Switch to Community Center"}
					</StudyButton>
				{/snippet}
			</StudyDialog>
		{/if}
	</div>
</div>

{#if !domain?.supported}
	<StudyAlert title="Community Center unavailable" tone="warning">
		<p>{domain?.reason ?? "Community Center data is unavailable."}</p>
	</StudyAlert>
{:else if domain.membership === true}
	<JojaProjectBoard community={domain} />

	<details class="retained-donations" bind:open={retainedOpen}>
		<summary>Retained Community Center donations</summary>

		{#if retainedOpen}
			{@render center()}
		{/if}
	</details>
{:else}
	{@render center()}
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

				<div class="room-actions">
					<StudyButton
						intent="constructive"
						disabled={roomBusy ||
							room?.completed === undefined ||
							domain.membership === undefined}
						onclick={() => void changeRoom(true)}
					>
						Complete room
					</StudyButton>

					<StudyButton
						disabled={roomBusy ||
							room?.completed === undefined ||
							domain.membership === undefined}
						onclick={() => void changeRoom(false)}
					>
						Reopen room
					</StudyButton>
				</div>

				{#if roomFeedback && roomFeedback.roomId === room?.id}
					<StudyAlert
						title="Room could not be changed"
						tone="danger"
						live="assertive"
					>
						<p>{roomFeedback.message}</p>
					</StudyAlert>
				{/if}

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

<style>
	.room-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 16px;
	}
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
	.route-control {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
	}
	.route-status {
		display: grid;
		gap: 4px;
		margin: 0;
		color: #694621;
		font-size: 18px;
	}
	.route-status strong {
		color: #311304;
		font-weight: 400;
		font-size: 21px;
	}
	.route-options {
		margin: 0 0 20px;
		padding: 0;
		border: 0;
	}
	.route-options legend {
		margin-bottom: 8px;
	}
	.route-options label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		cursor: pointer;
	}
	.route-options input {
		width: 22px;
		height: 22px;
		accent-color: #35763a;
	}
	.retained-donations {
		margin-top: 28px;
		border-top: 2px solid #b98b52;
	}
	.retained-donations summary {
		cursor: pointer;
		padding-block: 16px;
		min-height: 44px;
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
