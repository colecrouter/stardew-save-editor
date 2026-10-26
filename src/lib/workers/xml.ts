// Keep worker transport separate from the reusable, synchronous save codec.
import * as Comlink from "comlink";
import { XMLCodec } from "../xmlCodec.ts";

export class XMLManager extends XMLCodec {
	override stringify<T>(obj: T, pretty = false) {
		const bytes = super.stringify(obj, pretty);
		try {
			return Comlink.transfer(bytes, [bytes.buffer]);
		} catch {
			return bytes;
		}
	}
}

Comlink.expose(XMLManager);
