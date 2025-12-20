import { CommunityBundles } from "$lib/proxies/CommunityBundles.svelte";
import { Farmer } from "$lib/proxies/Farmer.svelte";
import { GameLocation } from "$lib/proxies/GameLocation.svelte";
import { type DataProxy, Raw } from ".";

export class SaveProxy implements DataProxy<SaveFile> {
	public [Raw]: SaveFile;

	// Reactive index of current player
	private index = $state(0);

	// Cached reactive arrays
	public players: Farmer[];
	public locations: GameLocation[];
	public farm: GameLocation | undefined; // derived
	public player: Farmer; // current player derived

	// Simple scalar reactive fields
	public goldenWalnuts: number;
	public deepestMineLevel: number;

	public communityBundles: CommunityBundles | undefined; // derived

	get raw() {
		return this[Raw];
	}

	constructor(data: SaveFile) {
		const gameVersion = data.SaveGame.gameVersion as string | undefined;
		if (!["1.6"].some((v) => gameVersion?.startsWith(v)))
			throw new Error(`Unsupported game version: ${gameVersion}`);
		this[Raw] = data;

		this.players = $state(this.buildPlayers());
		$effect(() => this.syncPlayers());
		this.player = $derived.by(() => {
			const p = this.players[this.index];
			if (!p) throw new Error("Player not found at current index");
			return p;
		});

		this.locations = $state(
			this[Raw].SaveGame.locations.GameLocation.map((l) => new GameLocation(l)),
		);
		$effect(() => {
			this[Raw].SaveGame.locations.GameLocation = this.locations.map(
				(l) => l[Raw],
			);
		});

		this.farm = $derived.by(() =>
			this.locations.find((l) => l[Raw].name === "Farm"),
		);
		this.communityBundles = new CommunityBundles(this);

		this.goldenWalnuts = $state(this[Raw].SaveGame.goldenWalnuts ?? 0);
		$effect(() => {
			this[Raw].SaveGame.goldenWalnuts = this.goldenWalnuts;
		});

		this.deepestMineLevel = $state(
			this[Raw].SaveGame.player.deepestMineLevel ?? 0,
		);
		$effect(() => {
			this[Raw].SaveGame.player.deepestMineLevel = this.deepestMineLevel;
		});
	}

	// Build initial Farmer proxy list
	// Keep track of which original indices map to which player proxies
	private playerIndexMap: Map<number, number> = new Map();

	private buildPlayers(): Farmer[] {
		const unfiltered =
			this[Raw].SaveGame.farmhands === ""
				? []
				: this[Raw].SaveGame.farmhands.Farmer;
		
		// Build players and track mapping from original index to player index
		const players: Farmer[] = [new Farmer(this[Raw].SaveGame.player)];
		this.playerIndexMap.clear();
		
		unfiltered.forEach((f, origIndex) => {
			if (f !== undefined && f.name?.trim() !== "") {
				this.playerIndexMap.set(origIndex, players.length);
				players.push(new Farmer(f));
			}
		});
		
		return players;
	}

	private syncPlayers() {
		const main = this.players[0];
		if (!main) return;
		const orig =
			this[Raw].SaveGame.farmhands === ""
				? []
				: this[Raw].SaveGame.farmhands.Farmer;
		const newFarmhands = orig.map((origRaw, origIndex) => {
			if (!origRaw.name?.trim()) return origRaw; // preserve ghost
			// Use the index map to find the correct player proxy
			const playerIndex = this.playerIndexMap.get(origIndex);
			if (playerIndex !== undefined) {
				return this.players[playerIndex]?.[Raw] ?? origRaw;
			}
			return origRaw;
		});
		// Append any newly added farmhands beyond original length
		const maxMappedPlayerIndex = Math.max(...Array.from(this.playerIndexMap.values()), 0);
		for (let i = maxMappedPlayerIndex + 1; i < this.players.length; i++) {
			const raw = this.players[i]?.[Raw];
			if (raw) newFarmhands.push(raw);
		}
		this[Raw].SaveGame.player = main[Raw];
		this[Raw].SaveGame.farmhands = { Farmer: newFarmhands };
	}

	public nextFarmer() {
		this.index = (this.index + 1) % this.players.length;
	}
	public prevFarmer() {
		this.index = (this.index - 1 + this.players.length) % this.players.length;
	}

	// To mutate farm location externally, provide a helper
	public setFarm(f: GameLocation) {
		if (!f) throw new Error("Farm is required");
		const idx = this.locations.findIndex((l) => l[Raw].name === "Farm");
		if (idx === -1) throw new Error("Farm not found");
		this.locations[idx] = f;
	}
}
