<script lang="ts">
	import { CCRoom } from "$lib/bundleSideEffects";
	import { Raw } from "$lib/proxies";
	import { MailFlag } from "$lib/proxies/Mail.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import Bundle from "./Bundle.svelte";
	import JojaBundles from "./JojaBundles.svelte";

	const save = getSaveManager().save;
	const bundles = save?.communityBundles;
	const cc = save?.locations.find((l) => l[Raw].name === "CommunityCenter");
	if (!save || !bundles) throw new Error("No save data found");

	// Rooms in the order they open up in-game, with what restoring each one unlocks
	// https://stardewvalleywiki.com/Bundles
	const rooms = [
		{
			room: CCRoom.CraftsRoom,
			name: "Crafts Room",
			icon: "🌿",
			reward: "Bridge to the Quarry repaired",
		},
		{
			room: CCRoom.Pantry,
			name: "Pantry",
			icon: "🥕",
			reward: "Greenhouse restored",
		},
		{
			room: CCRoom.FishTank,
			name: "Fish Tank",
			icon: "🐟",
			reward: "Glittering Boulder by the Mines removed",
		},
		{
			room: CCRoom.BoilerRoom,
			name: "Boiler Room",
			icon: "🔥",
			reward: "Minecarts repaired",
		},
		{
			room: CCRoom.BulletinBoard,
			name: "Bulletin Board",
			icon: "📌",
			reward:
				"+2 friendship hearts (500 points) with every villager you've met who isn't a marriage candidate",
			// The editor only sets the room's flags; it doesn't deliver the letter
			note: "In-game the hearts are given when Lewis's thank-you letter is read. The editor doesn't send that letter, so raise friendships on the Relationships page instead.",
		},
		{
			room: CCRoom.Vault,
			name: "Vault",
			icon: "💰",
			reward: "Bus repaired (access to the Calico Desert)",
		},
		{
			room: CCRoom.AbandonedJojaMart,
			name: "Abandoned JojaMart",
			icon: "🎬",
			reward: "Movie Theater built",
		},
	] satisfies {
		room: CCRoom;
		name: string;
		icon: string;
		reward: string;
		note?: string;
	}[];

	let bundlesByRoom = $derived(
		Map.groupBy(
			Array.from(bundles.values()).toSorted((a, b) => a.id - b.id),
			(b) => b.room,
		),
	);

	let hasJojaMembership = $derived(
		save.players.some((player) => player.mailReceived.has(MailFlag.JojaMember)),
	);

	function enableJojaMembership() {
		// IMPORTANT: mailReceived is a SvelteSet; do NOT replace the Set instance
		// or we lose reactivity. Mutate it directly so hasJojaMembership updates.
		for (const player of save?.players ?? []) {
			player.mailReceived.add(MailFlag.JojaMember);
			console.log("Enabled Joja Membership for player:", player.name);
		}
	}

	function disableJojaMembership() {
		for (const player of save?.players ?? []) {
			player.mailReceived.delete(MailFlag.JojaMember);
			console.log("Disabled Joja Membership for player:", player.name);
		}
	}
</script>

<UiContainer>
	<div class="warning">
		<h2>Under Construction 🏗️</h2>
		<p>Parts of this page are still being worked on.</p>
	</div>

	<h1>Community Bundles</h1>

	<!-- Enable or disable Joja Membership -->
	<label class="member-menu" data-testid="joja-toggle">
		<UiCheckbox
			type="checkbox"
			checked={hasJojaMembership}
			data-testid="joja-membership-checkbox"
			onchange={() => {
				if (hasJojaMembership) {
					disableJojaMembership();
				} else {
					enableJojaMembership();
				}
			}}
		/>
		Enable Joja Membership
	</label>

	{#if hasJojaMembership}
		{#if cc}
			<JojaBundles {save} {bundles} />
		{/if}
	{:else}
		<div class="wrapper" data-testid="bundle-wrapper">
			{#each rooms as { room, name, icon, reward, note } (room)}
				{@const list = bundlesByRoom.get(room)}
				{#if list}
					{@const done = list.every((b) => b.completed)}
					<section
						class="room"
						class:done
						data-testid="bundle-room"
						data-room={name}
					>
						<header>
							<span class="room-icon" aria-hidden="true">{icon}</span>
							<div class="room-title">
								<h2>{name}</h2>
								<small data-testid="bundle-room-progress">
									{list.filter((b) => b.completed).length}/{list.length} bundles
									{#if done}· Restored ✅{/if}
								</small>
							</div>
						</header>
						<p class="room-reward" data-testid="bundle-room-reward">
							🎁 <strong>Reward:</strong>
							{reward}
							{#if note}<br /><small class="room-note">{note}</small>{/if}
						</p>
						{#each list as bundle (bundle.id)}
							<Bundle {bundle} />
						{/each}
					</section>
				{/if}
			{/each}
		</div>
	{/if}
</UiContainer>

<style>
	.member-menu {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.warning {
		background-color: rgba(255, 0, 0, 0.35);
		border-left: solid 4px rgba(255, 0, 0, 0.7);
	}

	.warning > * {
		padding: 0.2rem;
		padding-left: 0.5rem;
		margin-block-start: 0.2em;
		margin-block-end: 0.2em;
	}

	.wrapper {
		height: 320px;
		overflow-y: auto;
	}

	.room {
		margin: 12px 4px;
		padding: 4px 4px 8px;
		border: 2px solid #b14e0544;
		border-radius: 8px;
		background: #fff3dc55;
	}

	.room.done {
		border-color: #3c8d2f88;
		background: #d8f0c855;
	}

	.room header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 4px 8px 0;
		padding-bottom: 4px;
		border-bottom: 2px solid #0003;
	}

	.room-icon {
		font-size: 1.6em;
	}

	.room-title {
		display: flex;
		flex-direction: column;
	}

	.room h2 {
		margin: 0;
		font-size: 1.1em;
	}

	.room-reward {
		margin: 6px 12px 0;
		font-size: 0.85em;
	}

	.room-note {
		opacity: 0.75;
	}
</style>
