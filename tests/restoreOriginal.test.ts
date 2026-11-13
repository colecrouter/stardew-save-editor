import { describe, expect, it } from "vitest";
import {
	restoreOriginal,
	serializeOriginal,
	type StoredOriginal,
} from "../src/lib/saveBackups";

// Restoring an archive must preserve bytes, rather than reinterpret compressed
// data as text. Cross encoder chunk boundaries and include every byte value.
describe("original backup restoration", () => {
	it("preserves all byte values across chunks and retains file metadata", async () => {
		const bytes = Uint8Array.from(
			{ length: 16_640 },
			(_, index) => index % 256,
		);
		const original = new File([bytes], "Farm_123", {
			type: "application/octet-stream",
			lastModified: 123_456,
		});
		const restored = restoreOriginal(await serializeOriginal(original));
		expect(new Uint8Array(await restored.arrayBuffer())).toEqual(bytes);
		expect(restored.name).toBe(original.name);
		expect(restored.type).toBe(original.type);
		expect(restored.lastModified).toBe(original.lastModified);
		expect(restored.size).toBe(original.size);
	});

	it.each(["", "é🌻"])("retains legacy UTF-8 archive text %j", async (data) => {
		const stored: StoredOriginal = {
			name: "LegacyFarm",
			data,
			lastModified: 1,
			size: new TextEncoder().encode(data).length,
			type: "text/xml",
		};
		expect(await restoreOriginal(stored).text()).toBe(data);
	});

	it("rejects invalid base64 instead of manufacturing replacement bytes", () => {
		expect(() =>
			restoreOriginal({
				name: "BrokenFarm",
				data: "%%%",
				encoding: "base64",
				lastModified: 1,
				size: 1,
				type: "",
			}),
		).toThrow();
	});
});
