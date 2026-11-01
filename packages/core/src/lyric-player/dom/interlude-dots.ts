import type { HasElement } from "#interfaces";
import {
	InterludeDotsBase,
	type InterludeDotsSnapshot,
} from "#lyric/base/interlude-dots.ts";
import styles from "#styles/lyric-player.module.css";

export class InterludeDotsEl extends InterludeDotsBase implements HasElement {
	private element = document.createElement("div");
	private dot0 = document.createElement("span");
	private dot1 = document.createElement("span");
	private dot2 = document.createElement("span");

	private lastStyle = "";

	constructor() {
		super();

		this.element.className = styles.interludeDots;
		this.element.appendChild(this.dot0);
		this.element.appendChild(this.dot1);
		this.element.appendChild(this.dot2);

		this.element.style.opacity = "0";
	}

	public getElement(): HTMLElement {
		return this.element;
	}

	protected override render(
		snapshot: Readonly<InterludeDotsSnapshot>,
		left: number,
		top: number,
	): void {
		const curStyle =
			`transform:translate(${left.toFixed(2)}px, ${top.toFixed(2)}px)` +
			` scale(${snapshot.scale.toFixed(4)});opacity:${snapshot.opacity.toFixed(3)}`;

		this.dot0.style.opacity = snapshot.dotOpacities[0].toFixed(3);
		this.dot1.style.opacity = snapshot.dotOpacities[1].toFixed(3);
		this.dot2.style.opacity = snapshot.dotOpacities[2].toFixed(3);

		if (this.lastStyle !== curStyle) {
			this.element.setAttribute("style", curStyle);
			this.lastStyle = curStyle;
		}
	}

	public override dispose(): void {
		super.dispose();
		this.element.remove();
	}
}
