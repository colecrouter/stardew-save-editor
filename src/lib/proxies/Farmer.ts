import { Color } from "$lib/proxies/Color";
import { Flags } from "$lib/proxies/Flags";
import { Inventory } from "$lib/proxies/Inventory";
import { Recipes } from "$lib/proxies/Recipes";
import { Skills } from "$lib/proxies/Skills";
import type { MailFlag } from "$lib/proxies/mail";
import type { Player } from "$types/save";
import type { Profession } from "./Professions.svelte";

export class Farmer {
    public raw: Player;

    constructor(player: Player | undefined) {
        if (!player) throw new Error("No player provided");

        this.raw = player;
    }

    public get maxHealth() {
        return this.raw?.maxHealth;
    }

    public set maxHealth(value) {
        this.raw.maxHealth = value;
    }

    public get maxStamina() {
        return this.raw?.maxStamina;
    }

    public set maxStamina(value) {
        this.raw.maxStamina = value;
    }

    public get qiGems() {
        return this.raw?.qiGems;
    }

    public set qiGems(value) {
        this.raw.qiGems = value;
    }

    public get money() {
        return this.raw?.money;
    }

    public set money(value) {
        this.raw.money = value;
    }

    public get totalMoneyEarned() {
        return this.raw?.totalMoneyEarned;
    }

    public set totalMoneyEarned(value) {
        this.raw.totalMoneyEarned = value;
    }

    public get gender() {
        return this.raw.gender;
    }

    public set gender(value) {
        this.raw.Gender = value;
        this.raw.gender = value;
    }

    public get name() {
        return this.raw.name;
    }

    public set name(value) {
        this.raw.name = value;
    }

    public get farmName() {
        return this.raw.farmName;
    }

    public set farmName(value) {
        this.raw.farmName = value;
    }

    public get favoriteThing() {
        return this.raw.favoriteThing;
    }

    public set favoriteThing(value) {
        this.raw.favoriteThing = value;
    }

    public get clubCoins() {
        return this.raw.clubCoins;
    }

    public set clubCoins(value) {
        this.raw.clubCoins = value;
    }

    public get hairstyle() {
        if (this.raw.hair >= 100) return this.raw.hair - 100 + 56;
        return this.raw.hair;
    }

    public set hairstyle(value) {
        if (value >= 56) {
            this.raw.hair = value + 100 - 56;
        } else {
            this.raw.hair = value;
        }
    }

    public get hairColor() {
        return new Color(this.raw.hairstyleColor);
    }

    public set hairColor(value) {
        this.raw.hairstyleColor = value;
    }

    public get skin() {
        return this.raw.skin;
    }

    public set skin(value) {
        this.raw.skin = value;
    }

    public get accessory() {
        return this.raw.accessory;
    }

    public set accessory(value) {
        this.raw.accessory = value;
    }

    get inventory() {
        return new Inventory(this.raw);
    }

    set inventory(value) {
        this.raw = { ...this.raw, ...value.raw };
    }

    get hat() {
        return this.inventory.hat;
    }

    get shirt() {
        return this.inventory.shirt;
    }

    get pants() {
        return this.inventory.pants;
    }

    get boots() {
        return this.inventory.boots;
    }

    get eyeColor() {
        return new Color(this.raw.newEyeColor);
    }

    set eyeColor(value: Color) {
        this.raw.newEyeColor = value;
    }

    get craftingRecipes() {
        return new Recipes(this.raw.craftingRecipes, "craftingRecipes");
    }

    set craftingRecipes(value: Recipes<"craftingRecipes">) {
        this.raw.craftingRecipes = value.raw;
    }

    get cookingRecipes() {
        return new Recipes(this.raw.cookingRecipes, "cookingRecipes");
    }

    set cookingRecipes(value: Recipes<"cookingRecipes">) {
        this.raw.cookingRecipes = value.raw;
    }

    get flags() {
        return new Flags(this.raw);
    }

    set flags(value: Flags) {
        this.raw = value.raw;
    }

    get skills() {
        return new Skills(this.raw.experiencePoints.int ?? [], this.raw);
    }

    set skills(value) {
        this.raw.experiencePoints.int = value.raw;
    }

    get professions() {
        return new Set(
            this.raw.professions.int?.map((p) => p as Profession) ?? [],
        );
    }

    set professions(value) {
        const compare = new Set(this.raw.professions.int ?? []);
        const diff = value.symmetricDifference(compare);
        if (diff.size === 0) return;

        this.raw.professions.int = [...value];
    }

    get uniqueID() {
        return this.raw.UniqueMultiplayerID;
    }

    get mailReceived() {
        return new Set(this.raw.mailReceived.string as MailFlag[]);
    }

    set mailReceived(value) {
        // Compare first
        const old = new Set(this.raw.mailReceived.string as MailFlag[]);
        if (old.symmetricDifference(value).size === 0) return;

        this.raw.mailReceived.string = [...value];
    }

    toJSON() {
        // Undo type safety enhancements
        // 1. Inventory, switch undefined into <string xsi:nil="true" /> (for farmhands, too) (flags too)
        // To be honest this is all kind of a hack. Realistically, we need something to parse through each node and convert
        // undefined to the appropriate xsi:nil attribute, but I couldn't find such a feature in fast-xml-parser

        // @ts-expect-error
        this.raw.items.Item = this.raw.items.Item.map((item) =>
            item === undefined ? { "@_xsi:nil": "true" } : item,
        );
        // @ts-expect-error
        this.raw.items.Item = this.raw.items.Item.map((item) =>
            item && "which" in item
                ? { ...item, which: { "@_xsi:nil": "true" } }
                : item,
        );

        return JSON.stringify(this.raw);
    }
}
