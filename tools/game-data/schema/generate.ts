import { decodeCatalog } from "./compiler/catalog.ts";
import { resolveContract } from "./compiler/contract.ts";
import { emitModule } from "./compiler/emit.ts";

// Generation is a pure three-step compiler. No stage loads the game, imports
// generated code, or writes files; the CLI owns those external boundaries.
export function generate(
	input: unknown,
	rootId: string,
	runtimeImport = "./xml-codecs.ts",
): string {
	// Validate the inspector's JSON and index CLR types before following references.
	const types = decodeCatalog(input);
	// Resolve XML annotations into supported field meanings, rejecting ambiguity.
	const contract = resolveContract(types, rootId);
	// Render the resolved contract as static Effect Schema declarations.
	return emitModule(contract, runtimeImport);
}
