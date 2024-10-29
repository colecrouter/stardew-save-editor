import type { Player, Save } from "$types/save/1.6";

class SaveClass {
    private filename = $state<string>();
    private saveData = $state<Save>();

    public players = $state<Player[]>([]);

    constructor() {
        // Update players array when save data changes
        $effect(() => {
            // Clear the players array when the save data changes
            if (!this.saveData) {
                this.players = [];
                return;
            }

            const farmers =
                this.saveData.farmhands.Farmer === undefined
                    ? []
                    : Array.isArray(this.saveData.farmhands.Farmer)
                      ? this.saveData.farmhands.Farmer
                      : [this.saveData.farmhands.Farmer];
            const mainPlayer = this.saveData.player;

            this.players = [mainPlayer, ...farmers];
        });

        // Update save data when the players array changes
        $effect(() => {
            if (!this.saveData) return;

            this.saveData.player = this.players[0];
            this.saveData.farmhands.Farmer = this.players.slice(1);
        });
    }
}
