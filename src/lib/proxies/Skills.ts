// [farming, mining, foraging, fishing, combat]

export class Skills {
    raw: number[];

    constructor(skills: number[]) {
        this.raw = skills;
    }

    get farming() {
        return this.raw[0] ?? 0;
    }

    set farming(value) {
        this.raw[0] = value;
    }

    get mining() {
        return this.raw[1] ?? 0;
    }

    set mining(value) {
        this.raw[1] = value;
    }

    get foraging() {
        return this.raw[2] ?? 0;
    }

    set foraging(value) {
        this.raw[2] = value;
    }

    get fishing() {
        return this.raw[3] ?? 0;
    }

    set fishing(value) {
        this.raw[3] = value;
    }

    get combat() {
        return this.raw[4] ?? 0;
    }

    set combat(value) {
        this.raw[4] = value;
    }
}
