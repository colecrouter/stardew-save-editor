import { describe, expect, it } from "vitest";

import { writeOptionalField } from "../src/lib/optional-field.ts";

interface IndexedSave {
	[key: string]: unknown;
	[key: number]: unknown;
	optional?: number | null;
	required: number;
	requiredMaybe: number | undefined;
}

// Compile-only ownership proof, checked by npm run check rather than invoked by
// Vitest: malformed calls must be rejected before they can mutate saved state.
export function optionalFieldTypeContract(saved: IndexedSave): void {
	// @ts-expect-error -- Required named fields cannot be cleared through an optional-field writer.
	writeOptionalField(saved, "required", undefined);
	// @ts-expect-error -- A required field stays required even when its value type includes undefined.
	writeOptionalField(saved, "requiredMaybe", undefined);
	// @ts-expect-error -- Opaque extension indexes do not establish an optional named field contract.
	writeOptionalField(saved, "extension", undefined);
	// @ts-expect-error -- An optional key keeps its own numeric value type rather than accepting arbitrary data.
	writeOptionalField(saved, "optional", "wrong");
}

describe("optional serialized fields", () => {
	it("deletes undefined fields while preserving explicit null and other fields", () => {
		const record: { selected?: number | null; preserved: string } = {
			selected: 7,
			preserved: "opaque",
		};
		writeOptionalField(record, "selected", undefined);
		expect(Object.hasOwn(record, "selected")).toBe(false);
		expect(record.preserved).toBe("opaque");
		writeOptionalField(record, "selected", null);
		expect(Object.hasOwn(record, "selected")).toBe(true);
		expect(record.selected).toBeNull();
		writeOptionalField(record, "selected", 0);
		expect(record.selected).toBe(0);
	});

	it("retains named-field contracts in generated models with extension indexes", () => {
		const saved: IndexedSave = { required: 1, requiredMaybe: undefined };
		writeOptionalField(saved, "optional", null);
		expect(saved.optional).toBeNull();
		writeOptionalField(saved, "optional", undefined);
		expect(Object.hasOwn(saved, "optional")).toBe(false);
		expect(Object.hasOwn(saved, "requiredMaybe")).toBe(true);
		expect(saved.required).toBe(1);
	});
});
