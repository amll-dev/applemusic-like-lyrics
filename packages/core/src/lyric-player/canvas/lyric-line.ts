import type { LyricLine } from "../../interfaces.ts";
import { chunkAndSplitLyricWords } from "../../utils/lyric-split-words.ts";
import { LyricLineBase } from "../base.ts";
import type { CanvasLyricPlayer } from "./index.ts";
import {
	type TextLayoutConfig,
	type TextLayoutResult,
	layoutLine,
} from "./text-layout";

export class CanvasLyricLine extends LyricLineBase {
	constructor(
		private player: CanvasLyricPlayer,
		private line: LyricLine = {
			words: [],
			translatedLyric: "",
			romanLyric: "",
			startTime: 0,
			endTime: 0,
			isBG: false,
			isDuet: false,
		},
	) {
		super();
		this.relayout();
	}

	override getLine(): LyricLine {
		return this.line;
	}
	private lineSize: [number, number] = [0, 0];
	measureSize(): [number, number] {
		const maxMainLineIndex = Math.max(
			0,
			...this.layoutWords.flat().map((w) => w.lineIndex + 1),
		);
		const maxTranslatedLineIndex = Math.max(
			0,
			...this.translatedLayoutWords.map((w) => w.lineIndex + 1),
		);
		const maxRomanLineIndex = Math.max(
			0,
			...this.romanLayoutWords.map((w) => w.lineIndex + 1),
		);
		const lineHeight = this.player.baseFontSize;
		this.lineSize = [
			this.player.size[0],
			(maxMainLineIndex + maxTranslatedLineIndex + maxRomanLineIndex) *
				lineHeight +
				this.player.size[1] * 0.04,
		];
		return [...this.lineSize];
	}

	private layoutWords: TextLayoutResult[][] = [];
	private translatedLayoutWords: TextLayoutResult[] = [];
	private romanLayoutWords: TextLayoutResult[] = [];
	private lineCanvas: HTMLCanvasElement = document.createElement("canvas");
	/** @internal */
	relayout(): void {
		const config: TextLayoutConfig = {
			fontSize: this.player.baseFontSize,
			maxWidth: this.player.size[0] - 50,
			lineHeight: this.player.baseFontSize,
			uniformSpace: true,
		};
		const ctx = this.player.ctx;
		this.player.setFontSize(1);
		for (const chunk of chunkAndSplitLyricWords(this.line.words)) {
			if (Array.isArray(chunk)) {
				if (chunk.length === 0) continue;
			} else {
			}
		}
		this.layoutWords = [
			[...layoutLine(ctx, this.line.words.map((w) => w.word).join(""), config)],
		];
		this.player.setFontSize(0.5);
		this.translatedLayoutWords = [
			...layoutLine(ctx, this.line.translatedLyric, config),
		];
		this.romanLayoutWords = [...layoutLine(ctx, this.line.romanLyric, config)];

		// 在自己的 Canvas 上绘制
		this.measureSize();

		this.lineCanvas.width = this.player.ctx.canvas.width;
		this.lineCanvas.height = this.lineSize[1] * devicePixelRatio;

		const lctx = this.lineCanvas.getContext("2d")!;
		lctx.globalAlpha = 1;
		this.player.setFontSize(1);
		lctx.font = ctx.font;
		lctx.scale(devicePixelRatio, devicePixelRatio);
		lctx.fillStyle = "white";
		lctx.textBaseline = "top";
		lctx.textAlign = "left";
		lctx.font = `${this.player.baseFontSize}px ${this.player.baseFontFamily}`;
		let lineIndex = 0;
		for (const word of this.layoutWords) {
			for (const layout of word) {
				lctx.fillText(
					layout.text,
					layout.x,
					layout.lineIndex *
						this.player.baseFontSize *
						this.player.baseLineHeight,
				);
				lineIndex = layout.lineIndex;
			}
		}
		lctx.translate(0, (lineIndex + 1) * this.player.baseFontSize);
		this.player.setFontSize(0.5);
		lctx.font = ctx.font;
		lctx.globalAlpha = 0.5;
		lineIndex = 0;
		for (const layout of this.translatedLayoutWords) {
			lctx.fillText(
				layout.text,
				layout.x,
				layout.lineIndex *
					this.player.baseFontSize *
					this.player.baseLineHeight,
			);
			lineIndex = layout.lineIndex;
		}
		lctx.translate(0, (lineIndex + 1) * this.player.baseFontSize);
		for (const layout of this.romanLayoutWords) {
			lctx.fillText(
				layout.text,
				layout.x,
				layout.lineIndex *
					this.player.baseFontSize *
					this.player.baseLineHeight,
			);
		}
	}
	override enable(): void {}
	override disable(): void {}
	override resume(): void {}
	override pause(): void {}
	override setTransform(
		top = this.top,
		scale = this.scale,
		opacity = this.opacity,
		blur = this.blur,
		force = false,
		delay = this.delay,
	): void {
		const targetBlur = Math.min(32, blur);
		// TODO: 实现模糊效果和不透明度效果的动画化
		this.blur = targetBlur;
		this.opacity = opacity;
		if (force) {
			this.lineTransforms.posY.setPosition(top);
			this.lineTransforms.scale.setPosition(scale);
		} else {
			this.lineTransforms.posY.setTargetPosition(top, delay);
			this.lineTransforms.scale.setTargetPosition(scale);
		}
	}
	get isInSight() {
		const t = this.lineTransforms.posY.getCurrentPosition();
		const r = this.lineSize[0];
		const b = t + this.lineSize[1];
		const pb = this.player.size[1];
		return !(t > pb || r < 0 || b < 0);
	}
	override update(delta?: number): void {
		this.lineTransforms.posY.update(delta);
		this.lineTransforms.scale.update(delta);
		if (!this.isInSight) return;
		const ctx = this.player.ctx;
		ctx.save();
		ctx.fillStyle = "white";
		ctx.filter = `blur(${this.blur}px)`;
		ctx.textRendering = "geometricPrecision";
		ctx.globalAlpha = this.opacity;
		ctx.translate(0, this.lineTransforms.posY.getCurrentPosition());
		ctx.scale(1 / devicePixelRatio, 1 / devicePixelRatio);
		if (this.lineCanvas.width * this.lineCanvas.height > 0)
			ctx.drawImage(this.lineCanvas, 0, 0);
		ctx.restore();
	}
}
