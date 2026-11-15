// These globals belong only to browser automation's isolated pages/workers.
// Production tsconfigs do not include them: an application cannot rely on probes.
export interface InputSample {
	phase: string;
	value: string;
	started: number;
	trusted: boolean;
	sequence: number;
}
export interface CommitSample extends InputSample {
	committed: number;
	commitMs: number;
	frameMs?: number;
}
export interface EditorProbe {
	phase: string | undefined;
	pending: InputSample[];
	commits: CommitSample[];
	inputs: InputSample[];
	keys: Array<{
		phase: string;
		type: string;
		key: string;
		timestamp: number;
		captureBoundMs: number;
	}>;
	timing: Array<{ type: string; timestamp: number; processingDelayMs: number }>;
	mismatches: Array<{ expected: string; actual: string }>;
	read: () => string;
	field: HTMLInputElement;
	node: Element;
	dispose: () => void;
}
export interface ExportSample {
	elapsedMs: number;
	pickerMs: number;
	active: boolean;
	bytes: number;
	maxStallMs: number;
	cloneCallsMs: number[];
}
export interface TransferCheck {
	before: number[];
	after?: number[];
}
export interface ImportSource {
	before: number[];
	after: number[];
	blobSize: number;
	mainReads: number;
}
declare global {
	interface PerformanceObserverInit {
		durationThreshold?: number;
	}
	interface Window {
		exportBenchmark: {
			samples: ExportSample[];
			cloneCalls: number[];
			started: number | undefined;
			lastTick: number;
			maxStallMs: number;
			timer?: number;
		};
		pickerProbe: {
			events: Array<{
				stage: string;
				active?: boolean;
				elapsedMs?: number;
				name?: string;
				message?: string;
			}>;
			started: number;
		};
		__ownedDownloadUrls: Set<string>;
		__editorProbe: EditorProbe;
		writes: string[];
		holdImport: boolean;
		holdExport: boolean;
		holdPicker: boolean;
		holdWrite: boolean;
		writeStarted: boolean;
		failWorkerStartup: string | undefined;
		startupAttempts: Array<{ failure: string | undefined }>;
		workerLifetimes: Array<{ terminated: boolean }>;
		fileReads: WeakMap<Blob, number>;
		heldImports: Array<{
			worker: Worker;
			message: unknown;
			options?: StructuredSerializeOptions | Transferable[];
		}>;
		importSources: ImportSource[];
		releaseExport: (() => void) | undefined;
		releasePicker: () => void;
		releaseWrite: () => void;
		transferChecks: TransferCheck[];
		heldResponses: number;
		responseHeld: Promise<void>;
		resolveHeldResponse: () => void;
	}
}
