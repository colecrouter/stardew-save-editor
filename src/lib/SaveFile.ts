import type { Player } from "$types/save/1.5";
import { get, writable, type Readable, type Writable } from "svelte/store";

export const SaveGame = writable<SaveFile | undefined>();
export const FileName = writable<string | undefined>();

class CharacterSelector {
    private _character: Writable<Player | undefined>;
    private _save: Writable<SaveFile | undefined>;
    private _index: number;
    private _players: Array<Player>;

    constructor(save: Writable<SaveFile | undefined>) {
        this._save = save;
        this._character = writable<Player | undefined>();

        // Make ts happy
        this._index = 0;
        this._players = [];

        const currSave = get(save);

        // Set the initial value
        this.reset();

        // Subscribe to changes
        save.subscribe(this.reset);
    }

    private reset = () => {
        const save = get(this._save);

        // Reset the index when the save changes
        this._index = 0;

        if (!save) { return; }

        // Set the initial value to the first character
        this._character.set(save.SaveGame.player);

        // Set the players array, so we can iterate over it
        this._players = [save.SaveGame.player, ...save.SaveGame.locations.GameLocation.find((loc) => loc.name === "Farm")?.buildings?.Building.map((b) => b.indoors?.farmhand!).filter((f) => f) ?? []];
    };

    public next = () => {
        this._index = (this._index + 1) % this._players.length;
        this._character.set(this._players[this._index]);
    };

    public prev = () => {
        this._index = (this._index - 1 + this._players.length) % this._players.length;
        this._character.set(this._players[this._index]);
    };

    public get character(): Readable<Player | undefined> {
        return this._character;
    }
}

export const Character = new CharacterSelector(SaveGame);