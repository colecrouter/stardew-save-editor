<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import { Result } from "effect";
	import type { EditorModel } from "../editor-model.ts";
	import type { CommandResult } from "../command-result.ts";
	import { createCommunityDomain } from "../community-domain.ts";
	import ConfirmAction from "./ConfirmAction.svelte";
	import CommunityBundleCard from "./CommunityBundleCard.svelte";
	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const domain = $derived(
		view.current
			? createCommunityDomain(model, view.current.community)
			: undefined,
	);
	let selectedRoom = $state(1);
	let revision: number | undefined;
	let error = $state("");
	const room = $derived(
		domain?.rooms.find((row) => row.id === selectedRoom) ?? domain?.rooms[0],
	);
	const bundles = $derived(
		domain?.bundles.filter((row) => row.room === room?.id) ?? [],
	);
	const projects = $derived(domain?.rooms.filter((row) => row.project) ?? []);
	const membershipChange = async () => {
		const target = domain;
		return target
			? await target.membershipChange(!target.membership, revision)
			: null;
	};
	async function perform(
		action: () => Promise<CommandResult<unknown, { message: string }>>,
	) {
		error = "";
		const result = await action();
		if (result && Result.isFailure(result)) error = result.failure.message;
	}
</script>

<h1>Community Center &amp; Joja</h1>
<p class="intro">
	Donations and their resulting restoration flags change together. Inventory
	items and gold stay untouched. Use Undo to revert the whole change.
</p>
{#if !domain?.supported}
	<p role="status">
		{domain?.reason ?? "Community Center data is unavailable."}
	</p>
{:else}
	<section class="membership" aria-label="Joja membership">
		<div>
			<h2>
				{domain.membership ? "Joja Community Development" : "Community Center"}
			</h2>
			<p>
				{domain.membership
					? "Projects are free edits; the displayed prices are their in-game cost."
					: "Complete the original six rooms to restore the center. The Missing Bundle is separate."}
			</p>
		</div>
		{#if domain.membership !== undefined}
			<ConfirmAction
				title={domain.membership
					? "Leave Joja membership?"
					: "Enable Joja membership?"}
				description="Changes membership for all farmers and updates the route-specific flags of completed rooms. Existing donations are retained. You can undo this action."
				label={domain.membership ? "Leave Joja" : "Enable Joja"}
				prepare={() => {
					revision = view.current?.revision;
				}}
				commit={membershipChange}
			/>
		{/if}
	</section>
	{#if error}
		<p role="alert">{error}</p>
	{/if}
	{#if domain.membership}
		<div class="projects">
			{#each projects as project (project.id)}
				<article>
					<div>
						<h3>{project.project}</h3>
						<p>{project.unlock}</p>
						<small>{project.price?.toLocaleString()}g in game</small>
					</div>
					<button
						type="button"
						disabled={project.completed === undefined}
						onclick={() => {
							const target = domain;
							if (!target) return;
							const completed = project.restored || project.completed === true;
							void perform(() => target.project(project.id, !completed));
						}}
					>
						{project.restored || project.completed
							? "Reopen project"
							: "Complete project"}
					</button>
				</article>
			{/each}
			<article>
				<div>
					<h3>Movie Theater</h3>
					<p>Separate from the five original Joja projects.</p>
					<small>1,000,000g in game</small>
				</div>
				<button
					type="button"
					disabled={!domain.theater &&
						projects.some((row) => !row.restored && row.completed !== true)}
					onclick={() => {
						const target = domain;
						if (target)
							void perform(() => target.theaterChange(!target.theater));
					}}
				>
					{domain.theater ? "Reopen theater project" : "Build Movie Theater"}
				</button>
			</article>
		</div>
		<p class="note">
			Bundle donations remain available below if you want to inspect or change
			their saved progress.
		</p>
	{/if}
	<div class="room-layout">
		<nav aria-label="Community Center rooms">
			{#each domain.rooms as row (row.id)}
				<button
					type="button"
					aria-pressed={room?.id === row.id}
					onclick={() => {
						selectedRoom = row.id;
						error = "";
					}}
				>
					<strong>{row.name}</strong>
					<small>
						{row.completed
							? "Donations complete"
							: row.completed === undefined
								? "No supported bundles"
								: "Donations in progress"}
					</small>
				</button>
			{/each}
		</nav>
		<section class="room" aria-label={room?.name}>
			<header>
				<h2>{room?.name}</h2>
				<p>{room?.unlock}</p>
				{#if room?.note}
					<p class="note">{room.note}</p>
				{/if}
			</header>
			{#if !bundles.length}
				<p>No saved bundles were found for this room.</p>
			{/if}
			{#each bundles as bundle (bundle.key)}
				<CommunityBundleCard bundle={domain.bundle(bundle)} />
			{/each}
		</section>
	</div>
	{#if domain.bundles.some((row) => row.room === undefined)}
		<details>
			<summary>Unsupported saved bundles</summary>
			{#each domain.bundles.filter((row) => row.room === undefined) as bundle (bundle.key)}
				<p>{bundle.name}: {bundle.reason}</p>
			{/each}
		</details>
	{/if}
{/if}

<style>
	h1 {
		font:
			32px "Pixelify Sans",
			sans-serif;
		margin: 0 0 8px;
	}
	h2 {
		margin: 0;
		font-size: 24px;
	}
	h3 {
		margin: 0;
		font-size: 20px;
	}
	.intro {
		color: #6b5239;
		max-width: 78ch;
		margin-bottom: 24px;
	}
	.membership {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
		background: #f2dfb6;
		border: 1px solid #bb9056;
		border-radius: 9px;
		padding: 18px;
		margin-bottom: 24px;
	}
	.membership p {
		margin: 6px 0 0;
		max-width: 65ch;
		font-size: 14px;
	}
	.room-layout {
		display: grid;
		grid-template-columns: 190px minmax(0, 1fr);
		gap: 24px;
	}
	nav {
		display: grid;
		align-content: start;
		gap: 8px;
	}
	button {
		font: inherit;
		color: inherit;
		border: 1px solid #b68a52;
		border-radius: 7px;
		padding: 10px 12px;
		background: #f4e3c2;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	nav button {
		text-align: left;
		display: grid;
		gap: 5px;
	}
	nav button[aria-pressed="true"] {
		background: #eac68b;
		border-color: #795226;
	}
	nav small,
	.note,
	small {
		color: #725333;
		font-size: 12px;
	}
	.room {
		min-width: 0;
		display: grid;
		align-content: start;
		gap: 18px;
	}
	.room header p {
		margin: 6px 0 0;
	}
	.projects {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
		gap: 14px;
		margin-bottom: 18px;
	}
	.projects article {
		display: flex;
		flex-direction: column;
		align-items: start;
		justify-content: space-between;
		gap: 14px;
		border: 1px solid #a9b9c7;
		background: #edf3f4;
		border-radius: 9px;
		padding: 18px;
	}
	.projects p {
		margin: 6px 0;
		font-size: 14px;
	}
	details {
		margin-top: 20px;
	}
	[role="alert"] {
		color: #972e1c;
	}
	@media (max-width: 750px) {
		.room-layout {
			grid-template-columns: minmax(0, 1fr);
			gap: 18px;
		}
		nav {
			display: flex;
			overflow-x: auto;
			padding-bottom: 4px;
		}
		nav button {
			flex: 0 0 155px;
		}
		h1 {
			font-size: 28px;
		}
	}
</style>
