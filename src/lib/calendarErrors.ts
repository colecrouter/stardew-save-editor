// Pure calendar planners are shared with the proxy-backed editor. Mark only
// deliberate validation rejections so Effect adapters never relabel defects.
export class CalendarDocumentError extends Error {
	override name = "CalendarDocumentError";
}
