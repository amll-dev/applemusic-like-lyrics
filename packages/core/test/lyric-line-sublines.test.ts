// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import type { DomLyricPlayer } from "#lyric/dom/index.ts";
import { LyricLineEl } from "#lyric/dom/lyric-line.ts";

const lines: LyricLineEl[] = [];

function createLine(): HTMLElement {
	const player = {
		_getIsNonDynamic: () => true,
	} as unknown as DomLyricPlayer;
	const line = new LyricLineEl(player, {
		words: [],
		translatedLyric: "translation",
		romanLyric: "romanization",
		startTime: 0,
		endTime: 0,
		isBG: false,
		isDuet: false,
	});
	lines.push(line);
	line.rebuildElement();
	return line.getElement();
}

describe("LyricLineEl styling hooks", () => {
	afterEach(() => {
		for (const line of lines) line.dispose();
		lines.length = 0;
	});

	it("marks the main, translation, and romanization containers", () => {
		const element = createLine();
		const main = element.children[0] as HTMLElement;
		const translation = element.children[1] as HTMLElement;
		const romanization = element.children[2] as HTMLElement;

		expect(main.dataset.amllRole).toBe("main");
		expect(translation.dataset.amllRole).toBe("translation");
		expect(romanization.dataset.amllRole).toBe("romanization");
		expect(translation.textContent).toBe("translation");
		expect(romanization.textContent).toBe("romanization");
	});
});
