import { Effect } from "effect";
import { expect, it } from "vitest";
import * as Xml from "../../src/lib/save-format/index.ts";

it("stops requesting XML input when the current batch has a typed failure", async () => {
	const codec = Xml.object({
		count: { xmlName: "count", codec: Xml.scalar("System.Int32") },
	});
	let requested = 0;
	function* chunks() {
		requested++;
		yield "<root><count>invalid</count></root>";
		// A streaming consumer must report the invalid value before reading ahead.
		// A defect here makes eager prefetch observable without a timing assertion.
		requested++;
		throw new Error("Read past the invalid XML batch");
	}
	const issue = await Effect.runPromise(
		Xml.decodeChunks("root", codec, chunks()).pipe(Effect.flip),
	);
	expect(issue._tag).toBe("Pointer");
	expect(requested).toBe(1);
});
