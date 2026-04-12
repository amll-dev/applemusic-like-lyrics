import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decryptQrcHex, encryptQrcHex } from "../src/formats/eqrc";
import { parseQrc } from "../src/formats/qrc";

function decodeXmlEntities(text: string): string {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/&#10;/g, "\n")
		.replace(/&#13;/g, "\r");
}

function extractQrcPayload(xmlLike: string): string {
	const match = xmlLike.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
	if (match?.[1]) return match[1].trim();
	const attrMatch = xmlLike.match(/LyricContent="([^"]*)"/);
	if (!attrMatch?.[1]) return "";
	return decodeXmlEntities(attrMatch[1]).trim();
}

describe("eqrc", () => {
	it("decrypts rust sample hex with stable output", () => {
		const hexPath = resolve(__dirname, "eqrc.hex");
		const hex = readFileSync(hexPath, "utf8").trim();
		const decrypted = decryptQrcHex(hex);
		const sha256 = createHash("sha256").update(decrypted).digest("hex");
		const qrcText = extractQrcPayload(decrypted);
		const lines = parseQrc(qrcText);

		expect(hex.length).toBe(7136);
		expect(decrypted.length).toBe(7188);
		expect(sha256).toBe(
			"f3bf2f3b5af01e9f21c5fc49e5ed9ab59370faa530f62b60a38df1881ea31f6a",
		);
		expect(decrypted).toContain("<QrcInfos>");
		expect(decrypted).toContain('<LyricInfo LyricCount="1">');
		expect(qrcText.length).toBeGreaterThan(0);
		expect(lines.length).toBeGreaterThan(0);
	});

	it("keeps decrypt/encrypt/decrypt text stable for rust sample", () => {
		const hexPath = resolve(__dirname, "eqrc.hex");
		const hex = readFileSync(hexPath, "utf8").trim();
		const decrypted = decryptQrcHex(hex);
		const encryptedAgain = encryptQrcHex(decrypted);
		const decryptedAgain = decryptQrcHex(encryptedAgain);

		expect(decryptedAgain).toBe(decrypted);
	});
});
