import { type ChestProxy, discoverChests } from "$lib/proxies/Chest.svelte";
import { CommunityBundles } from "$lib/proxies/CommunityBundles.svelte";
import type { FarmAnimal } from "$lib/proxies/FarmAnimal.svelte";
import { Farmer } from "$lib/proxies/Farmer.svelte";
import { GameLocation } from "$lib/proxies/GameLocation.svelte";
import type { MailFlag } from "$lib/proxies/Mail.svelte";
import { QiQuests } from "$lib/proxies/QiQuests.svelte";
import { type DataProxy, Raw } from ".";

export class SaveProxy implements DataProxy<SaveFile> {
	public [Raw]: SaveFile;

	// Reactive index of current player
	private index = $state(0);

	// Cached reactive arrays
	public players: Farmer[];
	public locations: GameLocation[];
	public chests: ChestProxy[];
	public farm: GameLocation | undefined; // derived
	public player: Farmer; // current player derived

	// Simple scalar reactive fields
	public goldenWalnuts: number;
	public deepestMineLevel: number;
	/** "Spawn monsters on the farm" new-game option */
	public shouldSpawnMonsters: boolean;
	/** "Mine rewards" new-game option: `Default` or `Remixed` */
	public shuffleMineChests: string;

	public communityBundles: CommunityBundles | undefined; // derived
	public qiQuests: QiQuests;

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
			this[Raw].SaveGame.locations.GameLocation.map(
				(l) => new GameLocation(l, this),
			),
		);
		$effect(() => {
			this[Raw].SaveGame.locations.GameLocation = this.locations.map(
				(l) => l[Raw],
			);
		});
		this.chests = $state(discoverChests(this[Raw].SaveGame));

		this.farm = $derived.by(() =>
			this.locations.find((l) => l[Raw].name === "Farm"),
		);
		this.communityBundles = new CommunityBundles(this);
		this.qiQuests = new QiQuests(this);

		this.goldenWalnuts = $state(this[Raw].SaveGame.goldenWalnuts ?? 0);
		$effect(() => {
			this[Raw].SaveGame.goldenWalnuts = this.goldenWalnuts;
		});

		this.shouldSpawnMonsters = $state(
			this[Raw].SaveGame.shouldSpawnMonsters === true,
		);
		$effect(() => {
			this[Raw].SaveGame.shouldSpawnMonsters = this.shouldSpawnMonsters;
		});

		this.shuffleMineChests = $state(
			this[Raw].SaveGame.shuffleMineChests || "Default",
		);
		$effect(() => {
			this[Raw].SaveGame.shuffleMineChests = this.shuffleMineChests;
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
		const homeLocations = this.homeLocationsBySlot;
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
		const maxMappedPlayerIndex = Math.max(
			...Array.from(this.playerIndexMap.values()),
			0,
		);
		for (let i = maxMappedPlayerIndex + 1; i < this.players.length; i++) {
			const raw = this.players[i]?.[Raw];
			if (raw) newFarmhands.push(raw);
		}
		this.syncHomeLocations(homeLocations);
		this[Raw].SaveGame.player = main[Raw];
		this[Raw].SaveGame.farmhands = { Farmer: newFarmhands };
		this.syncCellarAssignments();
	}

	private get rawPlayers() {
		const farmhands =
			this[Raw].SaveGame.farmhands === ""
				? []
				: this[Raw].SaveGame.farmhands.Farmer.filter((f) => f.name?.trim());
		return [this[Raw].SaveGame.player, ...farmhands];
	}

	private get homeLocationsBySlot() {
		const players = this.rawPlayers;
		const homes = players.map((player) => player.homeLocation);
		const cellarAssignments = this[Raw].SaveGame.cellarAssignments;
		if (!cellarAssignments) return homes;

		for (const player of players) {
			const assignment = cellarAssignments.item.find(
				(item) =>
					item.value.long.toString() === player.UniqueMultiplayerID.toString(),
			);
			if (assignment) homes[assignment.key.int - 1] = player.homeLocation;
		}

		return homes;
	}

	private syncHomeLocations(homeLocations: string[]) {
		for (const [index, player] of this.players.entries()) {
			const homeLocation = homeLocations[index];
			if (homeLocation) player[Raw].homeLocation = homeLocation;
		}

		for (const [index, player] of this.players.entries()) {
			if (index === 0) continue;
			const homeLocation = player[Raw].homeLocation;
			const cabin = this.findCabinByHomeLocation(homeLocation);
			if (cabin?.indoors) {
				cabin.indoors.farmhandReference = player[Raw].UniqueMultiplayerID;
			}
		}
	}

	private findCabinByHomeLocation(homeLocation: string) {
		for (const location of this[Raw].SaveGame.locations.GameLocation) {
			for (const building of location.buildings?.Building ?? []) {
				const indoors = building.indoors;
				if (
					indoors?.["@_xsi:type"] === "Cabin" &&
					(indoors.uniqueName === homeLocation || indoors.name === homeLocation)
				) {
					return building;
				}
			}
		}
	}

	private syncCellarAssignments() {
		const cellarAssignments = this[Raw].SaveGame.cellarAssignments;
		if (!cellarAssignments) return;

		const assignmentByCellar = new Map(
			cellarAssignments.item.map((item) => [item.key.int, item]),
		);
		const slotOneAssignment = assignmentByCellar.get(1) ?? {
			key: { int: 1 },
			value: { long: this.players[0]?.uniqueID ?? 0 },
		};
		assignmentByCellar.set(1, slotOneAssignment);

		for (const [cellarNumber, assignment] of assignmentByCellar) {
			const player = this.players[cellarNumber - 1];
			if (player) assignment.value.long = player.uniqueID;
		}

		const sortedAssignments = assignmentByCellar
			.values()
			.toArray()
			.sort((a, b) => a.key.int - b.key.int);
		cellarAssignments.item = sortedAssignments;
	}

	/** The farmer prevFarmer() would switch to */
	get previousPlayer() {
		const n = this.players.length;
		return this.players[(this.index - 1 + n) % n];
	}

	/** The farmer nextFarmer() would switch to */
	get nextPlayer() {
		return this.players[(this.index + 1) % this.players.length];
	}

	public nextFarmer() {
		this.index = (this.index + 1) % this.players.length;
	}
	public prevFarmer() {
		this.index = (this.index - 1 + this.players.length) % this.players.length;
	}

	/** Every farm animal, wherever it is: outside, or inside a building */
	get farmAnimals(): FarmAnimal[] {
		return this.locations.flatMap((location) => [
			...location.animals,
			// The farmhouse's interior is one of the locations already
			...location.buildings.flatMap((b) =>
				b[Raw].indoors ? (b.indoorLocation?.animals ?? []) : [],
			),
		]);
	}

	/** IDs of every farm animal, including residents of a building that aren't anywhere */
	get farmAnimalIds(): Set<string> {
		const ids = new Set(
			this.farmAnimals.flatMap((a) => [
				String(a[Raw].key.long),
				String(a[Raw].value.FarmAnimal.myID),
			]),
		);
		for (const location of this.locations)
			for (const building of location.buildings)
				for (const id of building.residentIds) ids.add(id);
		return ids;
	}

	/** Remember that a building type has been built (the team's constructedBuildings) */
	addConstructedBuilding(type: string) {
		const save = this[Raw].SaveGame;
		if (typeof save.constructedBuildings !== "object")
			save.constructedBuildings = { string: [] };
		const built = save.constructedBuildings;
		if (!Array.isArray(built.string)) built.string = [];
		if (!built.string.includes(type)) built.string.push(type);
	}

	/**
	    Send a letter to everyone, as Game1.addMail(key, sendToEveryone: true)
	    does: into each player's mailbox unless they've had it (or will), and
	    into broadcastedMail, for farmhands who join later.
	*/
	sendMailToEveryone(key: string) {
		const save = this[Raw].SaveGame;
		if (typeof save.broadcastedMail !== "object")
			save.broadcastedMail = { string: [] };
		const broadcast = save.broadcastedMail;
		if (!Array.isArray(broadcast.string)) broadcast.string = [];
		const seen = `%&SM&%${key}`;
		if (!broadcast.string.includes(seen)) broadcast.string.push(seen);

		for (const player of this.players) {
			const tomorrow = player[Raw].mailForTomorrow as unknown;
			const forTomorrow =
				typeof tomorrow === "object" &&
				tomorrow !== null &&
				"string" in tomorrow
					? [tomorrow.string].flat().map(String)
					: [];
			// Farmer.hasOrWillReceiveMail
			const has =
				player.mailReceived.has(key as MailFlag) ||
				player.mailbox.has(key as MailFlag) ||
				forTomorrow.some((m) => m === key || m === `${key}%&NL&%`);
			if (!has) player.mailbox.add(key as MailFlag);
		}
	}

	/** Start a conversation topic for every player, as the game does for each farmer */
	addDialogueEventForEveryone(id: string) {
		for (const player of this.players)
			player.autoGenerateActiveDialogueEvent(id);
	}

	// To mutate farm location externally, provide a helper
	public setFarm(f: GameLocation) {
		if (!f) throw new Error("Farm is required");
		const idx = this.locations.findIndex((l) => l[Raw].name === "Farm");
		if (idx === -1) throw new Error("Farm not found");
		this.locations[idx] = f;
	}
}
