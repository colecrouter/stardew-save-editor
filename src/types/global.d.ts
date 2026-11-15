import type { Save } from "../../codegen/save";

// Keep the legacy envelope available globally while resolving its type explicitly.
declare global {
	interface SaveFile {
		SaveGame: Save;
	}
}
