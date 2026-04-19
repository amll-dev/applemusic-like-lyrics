/** biome-ignore-all lint/suspicious/noAssignInExpressions: intentional */
/**
 * 核心的 TTML 生成器实现
 * @module generator
 */

import {
	Attributes,
	Elements,
	NodeType,
	NS,
	QualifiedAttributes,
	Values,
} from "./constants";
import type {
	Agent,
	BackgroundVocal,
	LyricBase,
	LyricLine,
	PlatformId,
	SubLyricContent,
	Syllable,
	TTMLMetadata,
	TTMLParserOptions,
	TTMLResult,
} from "./types";

/**
 * 临时的用于关联 Apple Music 样式的翻译和音译与主歌词行的容器
 */
interface IExtensionSidecar {
	[lineId: string]: {
		translations?: SubLyricContent[];
		romanizations?: SubLyricContent[];
		bgTranslations?: SubLyricContent[];
		bgRomanizations?: SubLyricContent[];
	};
}

interface IParsedState {
	fullText: string;
	words: Syllable[];
	translations: SubLyricContent[];
	romanizations: SubLyricContent[];
	bgTranslations: SubLyricContent[];
	bgRomanizations: SubLyricContent[];
	backgroundVocal?: BackgroundVocal;
}

/**
 * TTML 歌词生成器类
 *
 * 用于将 AMLL 项目使用的 TTML 字符串解析为结构化的 {@link TTMLResult} 数据结构
 * @see https://github.com/amll-dev/amll-ttml-db/wiki/%E6%A0%BC%E5%BC%8F%E8%A7%84%E8%8C%83
 */
export class TTMLParser {
	private domParser: DOMParser;

	private static readonly TIME_REGEX =
		/^(?:(?:(?<hours>\d+):)?(?<minutes>\d+):)?(?<seconds>\d+(?:\.\d+)?)$/;
	private static readonly LEADING_SPACE_REGEX = /^\s/;
	private static readonly TRAILING_SPACE_REGEX = /\s$/;
	private static readonly MULTI_SPACE_REGEX = /\s+/g;

	private normalizeText(
		text: string | null | undefined,
		trim: boolean = true,
	): string {
		if (!text) return "";
		const normalized = text.replace(TTMLParser.MULTI_SPACE_REGEX, " ");
		return trim ? normalized.trim() : normalized;
	}

	/**
	 * 构造一个 TTML 解析器实例
	 *
	 * @param options 生成器配置选项
	 *
	 * 在 Node.js 环境下必须注入 `domParser` 实例（例如用 `@xmldom/xmldom` 等）
	 */
	constructor(options?: TTMLParserOptions) {
		if (options?.domParser) {
			this.domParser = options.domParser as DOMParser;
		} else if (typeof DOMParser !== "undefined") {
			this.domParser = new DOMParser();
		} else {
			throw new Error(
				"No DOMParser found. If you are running in Node.js, please inject a DOMParser (e.g., @xmldom/xmldom).",
			);
		}
	}

	/**
	 * 解析 TTML 字符串的静态便捷方法
	 * @param xmlStr 需要解析的 TTML XML 字符串
	 * @param options 解析器配置选项，用于注入 DOM 依赖
	 * @returns 解析后的结构化 TTML 数据结构
	 * @throws 当输入的 XML 字符串格式无效时抛出异常
	 */
	public static parse(xmlStr: string, options?: TTMLParserOptions): TTMLResult {
		const instance = new TTMLParser(options);
		return instance.parse(xmlStr);
	}

	/**
	 * 解析 TTML 字符串
	 * @param xmlStr 需要解析的 TTML XML 字符串
	 * @returns 解析后的结构化 TTML 数据结构
	 * @throws 当输入的 XML 字符串格式无效时抛出异常
	 */
	public parse(xmlStr: string): TTMLResult {
		if (!xmlStr || typeof xmlStr !== "string") {
			throw new Error("TTMLParser: Input must be a valid XML string.");
		}

		const doc = this.domParser.parseFromString(xmlStr, Values.MimeXML);
		const { metadata, sidecar } = this.parseHead(doc);

		const parserError = doc.getElementsByTagName(Elements.ParserError)[0];
		if (parserError) {
			throw new Error(
				`TTMLParser: XML parsing error: ${parserError.textContent}`,
			);
		}

		const result: TTMLResult = {
			metadata: metadata,
			lines: [],
		};

		const root = doc.documentElement;
		if (root) {
			const lang = this.getAttr(root, NS.XML, Attributes.Lang);
			if (lang) {
				result.metadata.language = lang;
			}

			const timing = this.getAttr(root, NS.ITUNES, Attributes.Timing);
			if ((timing && timing === Values.Word) || timing === Values.Line) {
				result.metadata.timingMode = timing;
			}
		}

		this.parseBody(doc, result, sidecar);

		result.metadata.timingMode ??= this.inferTimingMode(result.lines);

		if (result.metadata.platformIds) {
			result.metadata.platformIds = this.sortPlatformIds(
				result.metadata.platformIds,
			);
		}

		return result;
	}

	private inferTimingMode(lines: LyricLine[]): "Word" | "Line" {
		const hasWordTiming = lines.some(
			(line) =>
				(line.words?.length ?? 0) > 1 ||
				(line.backgroundVocal?.words?.length ?? 0) > 1,
		);

		return hasWordTiming ? "Word" : "Line";
	}

	private sortPlatformIds(
		platformIds: Partial<Record<PlatformId, string[]>>,
	): Partial<Record<PlatformId, string[]>> {
		const preferredOrder: PlatformId[] = [
			"ncmMusicId",
			"qqMusicId",
			"spotifyId",
			"appleMusicId",
		];

		const orderedPlatformIds: Partial<Record<PlatformId, string[]>> = {};

		for (const key of preferredOrder) {
			if (platformIds[key]) {
				orderedPlatformIds[key] = platformIds[key];
			}
		}

		for (const key of Object.keys(platformIds) as PlatformId[]) {
			if (!orderedPlatformIds[key]) {
				orderedPlatformIds[key] = platformIds[key];
			}
		}

		return orderedPlatformIds;
	}

	private parseHead(doc: Document): {
		metadata: TTMLMetadata;
		sidecar: IExtensionSidecar;
	} {
		const head = doc.getElementsByTagName(Elements.Head)[0];

		const resultMeta: TTMLMetadata = {
			title: [],
			artist: [],
			album: [],
			isrc: [],
			authorIds: [],
			authorNames: [],
			songwriters: [],
			agents: {},
			rawProperties: {},
		};
		const sidecar: IExtensionSidecar = {};

		if (!head) {
			return { metadata: resultMeta, sidecar };
		}

		this.parseTTMElements(head, resultMeta);
		this.parseAMLLMeta(head, resultMeta);
		this.parseiTunesExtensions(head, resultMeta, sidecar);
		this.deduplicateMetadata(resultMeta);

		return { metadata: resultMeta, sidecar };
	}

	private deduplicateMetadata(meta: TTMLMetadata) {
		const dedupe = (arr?: string[]) => (arr ? Array.from(new Set(arr)) : []);

		meta.title = dedupe(meta.title);
		meta.artist = dedupe(meta.artist);
		meta.album = dedupe(meta.album);
		meta.isrc = dedupe(meta.isrc);
		meta.authorIds = dedupe(meta.authorIds);
		meta.authorNames = dedupe(meta.authorNames);
		meta.songwriters = dedupe(meta.songwriters);

		if (meta.platformIds) {
			for (const key of Object.keys(meta.platformIds) as PlatformId[]) {
				if (meta.platformIds[key]) {
					meta.platformIds[key] = dedupe(meta.platformIds[key]);
				}
			}
		}

		if (meta.rawProperties) {
			for (const key of Object.keys(meta.rawProperties)) {
				if (meta.rawProperties[key]) {
					meta.rawProperties[key] = dedupe(meta.rawProperties[key]);
				}
			}
		}
	}

	private parseTTMElements(head: Element, meta: TTMLMetadata) {
		const titles = head.getElementsByTagNameNS(NS.TTM, Elements.Title);
		if (titles.length > 0 && titles[0].textContent) {
			meta.title?.push(titles[0].textContent.trim());
		}

		const agents = Array.from(
			head.getElementsByTagNameNS(NS.TTM, Elements.Agent),
		);

		for (const agent of agents) {
			const id = this.getAttr(agent, NS.XML, Attributes.Id);

			if (!id) continue;

			const type = this.getAttr(
				agent,
				NS.TTM,
				Attributes.Type,
				Attributes.Type,
			);

			const names = agent.getElementsByTagNameNS(NS.TTM, Elements.Name);

			const agentObj: Agent = {
				id: id,
			};

			if (type) {
				agentObj.type = type;
			}

			if (names.length > 0 && names[0].textContent) {
				const rawName = names[0].textContent.trim();
				if (rawName.length > 0) {
					agentObj.name = rawName;
				}
			}

			meta.agents ??= {};
			meta.agents[id] = agentObj;
		}
	}

	private parseAMLLMeta(head: Element, meta: TTMLMetadata) {
		const metas = Array.from(
			head.getElementsByTagNameNS(NS.AMLL, Elements.Meta),
		);

		const validMetas = metas.filter((el) => {
			return (
				this.getAttr(el, NS.AMLL, Attributes.Key) &&
				this.getAttr(el, NS.AMLL, Attributes.Value)
			);
		});

		for (const el of validMetas) {
			const key = this.getAttr(el, NS.AMLL, Attributes.Key);
			const value = this.getAttr(el, NS.AMLL, Attributes.Value)?.trim();

			if (!key || !value) continue;

			switch (key) {
				case Values.MusicName:
					meta.title?.push(value);
					break;
				case Values.Artists:
					meta.artist?.push(value);
					break;
				case Values.Album:
					meta.album?.push(value);
					break;
				case Values.ISRC:
					meta.isrc?.push(value);
					break;
				case Values.TTMLAuthorGithub:
					meta.authorIds?.push(value);
					break;
				case Values.TTMLAuthorGithubLogin:
					meta.authorNames?.push(value);
					break;
				case Values.NCMMusicId:
				case Values.QQMusicId:
				case Values.SpotifyId:
				case Values.AppleMusicId:
					meta.platformIds ??= {};
					(meta.platformIds[key] ??= []).push(value);
					break;
				default:
					meta.rawProperties ??= {};
					(meta.rawProperties[key] ??= []).push(value);
					break;
			}
		}
	}

	private extractSubContent(
		base: LyricBase | BackgroundVocal,
		lang: string | null,
		ignoreWords: boolean = false,
	): { main?: SubLyricContent; bg?: SubLyricContent } {
		const result: { main?: SubLyricContent; bg?: SubLyricContent } = {};

		const mainText = this.normalizeText(base.text);
		const hasMainWords = !ignoreWords && base.words && base.words.length > 0;

		if (mainText || hasMainWords) {
			const main: SubLyricContent = { text: mainText };
			if (lang) main.language = lang;

			if (hasMainWords) {
				const isZeroFallback =
					base.words?.length === 1 &&
					base.words?.[0].startTime === 0 &&
					base.words?.[0].endTime === 0;

				if (!isZeroFallback) main.words = base.words;
			}
			result.main = main;
		}

		if ("backgroundVocal" in base && base.backgroundVocal) {
			const bgVocal = base.backgroundVocal;
			const bgText = this.normalizeText(bgVocal.text);
			const hasBgWords =
				!ignoreWords && bgVocal.words && bgVocal.words.length > 0;

			if (bgText || hasBgWords) {
				const bg: SubLyricContent = { text: bgText };
				if (lang) bg.language = lang;

				if (hasBgWords) {
					const isZeroFallback =
						bgVocal.words?.length === 1 &&
						bgVocal.words?.[0].startTime === 0 &&
						bgVocal.words?.[0].endTime === 0;

					if (!isZeroFallback) bg.words = bgVocal.words;
				}
				result.bg = bg;
			}
		}

		return result;
	}

	private parseiTunesExtensions(
		head: Element,
		meta: TTMLMetadata,
		sidecar: IExtensionSidecar,
	) {
		const iTunesMetas = Array.from(
			head.getElementsByTagName(Elements.ITunesMetadata),
		);
		if (iTunesMetas.length === 0) return;

		for (const iTunesMeta of iTunesMetas) {
			const songwritersContainer = iTunesMeta.getElementsByTagName(
				Elements.Songwriters,
			)[0];
			if (songwritersContainer) {
				const writers = Array.from(
					songwritersContainer.getElementsByTagName(Elements.Songwriter),
				);
				for (const writer of writers) {
					const name = writer.textContent?.trim();
					if (name) {
						meta.songwriters?.push(name);
					}
				}
			}

			const processEntries = (
				containerTagName: string,
				itemTagName: string,
				type: "translations" | "romanizations",
			) => {
				const container = iTunesMeta.getElementsByTagName(containerTagName)[0];
				if (!container) return;

				const items = Array.from(container.getElementsByTagName(itemTagName));
				for (const item of items) {
					const lang = this.getAttr(item, NS.XML, Attributes.Lang);

					const textNodes = Array.from(
						item.getElementsByTagName(Elements.Text),
					);
					for (const textNode of textNodes) {
						const forId = textNode.getAttribute(Attributes.For);
						const parsedContent = this.parseCommonContent(textNode);

						if (forId) {
							const subContents = this.extractSubContent(
								parsedContent,
								lang,
								false,
							);
							sidecar[forId] ??= {};

							if (subContents.main) {
								(sidecar[forId][type] ??= []).push(subContents.main);
							}

							if (subContents.bg) {
								const bgType =
									type === "translations"
										? "bgTranslations"
										: "bgRomanizations";
								(sidecar[forId][bgType] ??= []).push(subContents.bg);
							}
						}
					}
				}
			};

			processEntries(
				Elements.Translations,
				Elements.Translation,
				"translations",
			);
			processEntries(
				Elements.Transliterations,
				Elements.Transliteration,
				"romanizations",
			);
		}
	}

	private parseTime(timeStr: string | null): number {
		if (!timeStr) return 0;

		const cleanStr = timeStr.trim();
		if (cleanStr.length === 0) return 0;

		if (cleanStr.endsWith("s")) {
			const seconds = Number(cleanStr.slice(0, -1));
			if (Number.isNaN(seconds)) {
				return 0;
			}
			return Math.round(seconds * 1000);
		}

		const match = cleanStr.match(TTMLParser.TIME_REGEX);

		if (match?.groups) {
			const { seconds, minutes, hours } = match.groups;

			const secNum = Number(seconds);
			const minNum = minutes ? parseInt(minutes, 10) : 0;
			const hrNum = hours ? parseInt(hours, 10) : 0;

			if (
				!Number.isNaN(secNum) &&
				!Number.isNaN(minNum) &&
				!Number.isNaN(hrNum)
			) {
				const totalSeconds = hrNum * 3600 + minNum * 60 + secNum;
				return Math.round(totalSeconds * 1000);
			}
		}
		return 0;
	}

	private parseBody(
		doc: Document,
		result: TTMLResult,
		sidecar: IExtensionSidecar,
	) {
		const body = doc.getElementsByTagName(Elements.Body)[0];
		if (!body) return;

		const childNodes = Array.from(body.childNodes);
		let currentBlockIndex = 0;

		for (const node of childNodes) {
			if (node.nodeType !== NodeType.ELEMENT_NODE) continue;
			const el = node as Element;

			const tagName = el.localName || el.tagName.toLowerCase().split(":").pop();

			if (tagName === Elements.Div) {
				currentBlockIndex++;

				const songPart =
					this.getAttr(el, NS.ITUNES, Attributes.SongPartKebab) ||
					this.getAttr(el, NS.ITUNES, Attributes.SongPart);

				const pNodes = el.getElementsByTagNameNS(NS.TT, Elements.P);
				const pList =
					pNodes.length > 0
						? Array.from(pNodes)
						: Array.from(el.getElementsByTagName(Elements.P));

				for (const p of pList) {
					this.processLineElement(
						p,
						result.lines,
						sidecar,
						songPart,
						currentBlockIndex,
					);
				}
			} else if (tagName === Elements.P) {
				currentBlockIndex++;
				this.processLineElement(
					el,
					result.lines,
					sidecar,
					undefined,
					currentBlockIndex,
				);
			}
		}
	}

	private processLineElement(
		p: Element,
		lines: LyricLine[],
		sidecar: IExtensionSidecar,
		songPart?: string | null,
		blockIndex?: number,
	) {
		const id = this.getAttr(p, NS.ITUNES, Attributes.Key);
		if (!id) return;

		const baseContent = this.parseCommonContent(p);

		const line: LyricLine = {
			id: id,
			...baseContent,
		};

		if (songPart) line.songPart = songPart;
		if (blockIndex !== undefined) line.blockIndex = blockIndex;

		const agentId = this.getAttr(p, NS.TTM, Elements.Agent);
		if (agentId) line.agentId = agentId;

		const externalData = sidecar[id];
		if (externalData) {
			if (externalData.translations) {
				(line.translations ??= []).push(...externalData.translations);
			}
			if (externalData.romanizations) {
				(line.romanizations ??= []).push(...externalData.romanizations);
			}
			if (externalData.bgTranslations && line.backgroundVocal) {
				(line.backgroundVocal.translations ??= []).push(
					...externalData.bgTranslations,
				);
			}
			if (externalData.bgRomanizations && line.backgroundVocal) {
				(line.backgroundVocal.romanizations ??= []).push(
					...externalData.bgRomanizations,
				);
			}
		}

		lines.push(line);
	}

	private parseCommonContent(element: Element): LyricBase {
		const beginAttr = this.getAttr(
			element,
			NS.XML,
			Attributes.Begin,
			Attributes.Begin,
		);
		const endAttr = this.getAttr(
			element,
			NS.XML,
			Attributes.End,
			Attributes.End,
		);
		const originalStartTime = this.parseTime(beginAttr);
		const originalEndTime = this.parseTime(endAttr);

		const state = this.extractNodeState(element);

		if (state.backgroundVocal) {
			if (state.bgTranslations.length > 0) {
				(state.backgroundVocal.translations ??= []).push(
					...state.bgTranslations,
				);
			}
			if (state.bgRomanizations.length > 0) {
				(state.backgroundVocal.romanizations ??= []).push(
					...state.bgRomanizations,
				);
			}
		}

		this.finalizeWords(state.words);

		const { startTime, endTime } = this.calculateTimeRange(
			originalStartTime,
			originalEndTime,
			state.words,
			state.backgroundVocal,
		);

		const cleanFullText = this.normalizeText(state.fullText);
		const hasTimeAttrs = beginAttr !== null || endAttr !== null;
		this.applyFallbackWord(
			state.words,
			cleanFullText,
			hasTimeAttrs,
			originalStartTime,
			originalEndTime,
			startTime,
			endTime,
		);

		return this.buildLyricBase(state, cleanFullText, startTime, endTime);
	}

	private extractNodeState(element: Element): IParsedState {
		const state: IParsedState = {
			fullText: "",
			words: [],
			translations: [],
			romanizations: [],
			bgTranslations: [],
			bgRomanizations: [],
			backgroundVocal: undefined,
		};

		const childNodes = Array.from(element.childNodes);
		for (const node of childNodes) {
			if (node.nodeType === NodeType.TEXT_NODE) {
				this.processTextNode(state, node);
			} else if (node.nodeType === NodeType.ELEMENT_NODE) {
				this.processElementNode(state, node as Element);
			}
		}

		return state;
	}

	private calculateTimeRange(
		originalStart: number,
		originalEnd: number,
		words: Syllable[],
		bgVocal?: BackgroundVocal,
	): { startTime: number; endTime: number } {
		let startTime = originalStart;
		let endTime = originalEnd;

		const timedElements = [...words];
		if (bgVocal) {
			timedElements.push(bgVocal);
		}

		if (timedElements.length > 0) {
			let minChildStart = Infinity;
			let maxChildEnd = 0;

			for (const el of timedElements) {
				if (el.startTime < minChildStart) minChildStart = el.startTime;
				if (el.endTime > maxChildEnd) maxChildEnd = el.endTime;
			}

			if (startTime === 0 || (minChildStart > 0 && minChildStart < startTime)) {
				startTime = minChildStart === Infinity ? 0 : minChildStart;
			}

			if (endTime === 0 || maxChildEnd > endTime) {
				endTime = maxChildEnd;
			}
		}

		return { startTime, endTime };
	}

	private applyFallbackWord(
		words: Syllable[],
		cleanText: string,
		hasTimeAttrs: boolean,
		origStart: number,
		origEnd: number,
		calcStart: number,
		calcEnd: number,
	): void {
		if (words.length === 0 && cleanText.length > 0 && hasTimeAttrs) {
			words.push({
				text: cleanText,
				startTime: origStart > 0 ? origStart : calcStart,
				endTime: origEnd > 0 ? origEnd : calcEnd,
				endsWithSpace: false,
			});
		}
	}

	private buildLyricBase(
		state: IParsedState,
		cleanText: string,
		startTime: number,
		endTime: number,
	): LyricBase {
		return {
			text: cleanText,
			startTime,
			endTime,
			words: state.words.length > 0 ? state.words : undefined,
			translations:
				state.translations.length > 0 ? state.translations : undefined,
			romanizations:
				state.romanizations.length > 0 ? state.romanizations : undefined,
			backgroundVocal: state.backgroundVocal,
		};
	}

	private processTextNode(state: IParsedState, node: Node): void {
		const rawText = node.textContent || "";
		const isFormatting = rawText.includes("\n");

		if (isFormatting && rawText.trim().length === 0) return;

		const normalizedText = this.normalizeText(rawText, false);

		state.fullText += normalizedText;

		if (
			!isFormatting &&
			normalizedText.length > 0 &&
			normalizedText.trim().length === 0
		) {
			if (state.words.length > 0) {
				state.words[state.words.length - 1].endsWithSpace = true;
			}
		}
	}

	private processElementNode(state: IParsedState, el: Element): void {
		const role = this.getAttr(el, NS.TTM, Attributes.Role);

		const rubyAttr = this.getAttr(
			el,
			NS.TTS,
			Attributes.Ruby,
			QualifiedAttributes.TtsRuby,
		);

		if (rubyAttr === Values.RubyContainer) {
			this.processRubyElement(state, el);
			return;
		}

		switch (role) {
			case Values.RoleBg:
				state.backgroundVocal = this.parseBackgroundVocal(el);
				break;
			case Values.RoleTranslation: {
				const translation = this.parseInlineSubContent(el);
				if (translation) {
					if (translation.main) state.translations.push(translation.main);
					if (translation.bg) state.bgTranslations.push(translation.bg);
				}
				break;
			}
			case Values.RoleRoman: {
				const romanization = this.parseInlineSubContent(el);
				if (romanization) {
					if (romanization.main) state.romanizations.push(romanization.main);
					if (romanization.bg) state.bgRomanizations.push(romanization.bg);
				}
				break;
			}
			default:
				this.processWordElement(state, el);
				break;
		}
	}

	private processRubyElement(state: IParsedState, containerEl: Element): void {
		const obsceneAttr = this.getAttr(
			containerEl,
			NS.AMLL,
			Attributes.Obscene,
			QualifiedAttributes.AmllObscene,
		);
		const isObscene = obsceneAttr === "true";

		const emptyBeatAttr = this.getAttr(
			containerEl,
			NS.AMLL,
			Attributes.EmptyBeat,
			QualifiedAttributes.AmllEmptyBeat,
		);
		let emptyBeat: number | undefined;
		if (emptyBeatAttr) {
			const parsedBeat = parseInt(emptyBeatAttr, 10);
			if (!Number.isNaN(parsedBeat)) {
				emptyBeat = parsedBeat;
			}
		}

		let baseText = "";
		const rubyTags: { text: string; startTime: number; endTime: number }[] = [];

		const childNodes = Array.from(containerEl.childNodes);

		for (const node of childNodes) {
			if (node.nodeType !== NodeType.ELEMENT_NODE) continue;
			const childEl = node as Element;

			const childRubyAttr = this.getAttr(
				childEl,
				NS.TTS,
				Attributes.Ruby,
				QualifiedAttributes.TtsRuby,
			);

			if (childRubyAttr === Values.RubyBase) {
				baseText = this.normalizeText(childEl.textContent, false);
			} else if (childRubyAttr === Values.RubyTextContainer) {
				const textNodes = Array.from(childEl.childNodes);
				for (const textNode of textNodes) {
					if (textNode.nodeType !== NodeType.ELEMENT_NODE) continue;
					const tNode = textNode as Element;

					const tAttr = this.getAttr(
						tNode,
						NS.TTS,
						Attributes.Ruby,
						QualifiedAttributes.TtsRuby,
					);

					if (tAttr === Values.RubyText) {
						const begin = this.getAttr(
							tNode,
							NS.XML,
							Attributes.Begin,
							Attributes.Begin,
						);
						const end = this.getAttr(
							tNode,
							NS.XML,
							Attributes.End,
							Attributes.End,
						);
						const text = this.normalizeText(tNode.textContent, false).trim();

						if (text && begin && end) {
							rubyTags.push({
								text,
								startTime: this.parseTime(begin),
								endTime: this.parseTime(end),
							});
						}
					}
				}
			}
		}

		if (!baseText) return;

		state.fullText += baseText;

		let startTime = 0;
		let endTime = 0;
		if (rubyTags.length > 0) {
			startTime = Math.min(...rubyTags.map((t) => t.startTime));
			endTime = Math.max(...rubyTags.map((t) => t.endTime));
		}

		const cleanBaseText = baseText.trim();
		if (cleanBaseText.length > 0) {
			const endsWithSpace = TTMLParser.TRAILING_SPACE_REGEX.test(baseText);
			const startsWithSpace = TTMLParser.LEADING_SPACE_REGEX.test(baseText);

			if (startsWithSpace && state.words.length > 0) {
				state.words[state.words.length - 1].endsWithSpace = true;
			}

			state.words.push({
				text: cleanBaseText,
				startTime,
				endTime,
				ruby: rubyTags.length > 0 ? rubyTags : undefined,
				endsWithSpace: endsWithSpace,
				obscene: isObscene ? true : undefined,
				emptyBeat,
			});
		}
	}

	private processWordElement(state: IParsedState, el: Element): void {
		const wBegin = this.getAttr(el, NS.XML, Attributes.Begin, Attributes.Begin);
		const wEnd = this.getAttr(el, NS.XML, Attributes.End, Attributes.End);

		const obsceneAttr = this.getAttr(
			el,
			NS.AMLL,
			Attributes.Obscene,
			QualifiedAttributes.AmllObscene,
		);
		const isObscene = obsceneAttr === "true";

		const emptyBeatAttr = this.getAttr(
			el,
			NS.AMLL,
			Attributes.EmptyBeat,
			QualifiedAttributes.AmllEmptyBeat,
		);
		let emptyBeat: number | undefined;
		if (emptyBeatAttr) {
			const parsedBeat = parseInt(emptyBeatAttr, 10);
			if (!Number.isNaN(parsedBeat)) {
				emptyBeat = parsedBeat;
			}
		}

		const rawWText = el.textContent || "";
		const normalizedWText = this.normalizeText(rawWText, false);

		state.fullText += normalizedWText;

		if (wBegin && wEnd) {
			const isFormatting = rawWText.includes("\n");

			let startsWithSpace = false;
			let endsWithSpace = false;

			if (!isFormatting) {
				startsWithSpace = TTMLParser.LEADING_SPACE_REGEX.test(normalizedWText);
				endsWithSpace = TTMLParser.TRAILING_SPACE_REGEX.test(normalizedWText);
			}

			const cleanText = normalizedWText.trim();

			if (startsWithSpace && state.words.length > 0) {
				state.words[state.words.length - 1].endsWithSpace = true;
			}

			if (cleanText.length > 0) {
				state.words.push({
					text: cleanText,
					startTime: this.parseTime(wBegin),
					endTime: this.parseTime(wEnd),
					endsWithSpace: endsWithSpace,
					obscene: isObscene ? true : undefined,
					emptyBeat,
				});
			}
		}
	}

	private parseBackgroundVocal(el: Element): BackgroundVocal {
		const parsed = this.parseCommonContent(el);
		const { backgroundVocal, ...bgVocal } = parsed;

		bgVocal.text = bgVocal.text.replace(/^[(（]+/, "").replace(/[)）]+$/, "");

		if (bgVocal.words && bgVocal.words.length > 0) {
			bgVocal.words[0].text = bgVocal.words[0].text
				.replace(/^[(（]+/, "")
				.trimStart();

			const lastIdx = bgVocal.words.length - 1;
			bgVocal.words[lastIdx].text = bgVocal.words[lastIdx].text
				.replace(/[)）]+$/, "")
				.trimEnd();
		}

		return bgVocal;
	}

	private parseInlineSubContent(
		el: Element,
	): { main?: SubLyricContent; bg?: SubLyricContent } | null {
		const lang = this.getAttr(el, NS.XML, Attributes.Lang);
		const parsed = this.parseCommonContent(el);

		// 内联的音译和翻译不会出现逐字内容，只有 sidecar 里才会有逐字翻译和音译
		const content = this.extractSubContent(parsed, lang, true);

		if (content.main || content.bg) {
			return content;
		}

		return null;
	}

	private finalizeWords(words: Syllable[]): Syllable[] {
		if (words.length === 0) return [];

		words[0].text = words[0].text.trimStart();

		const lastIdx = words.length - 1;
		words[lastIdx].text = words[lastIdx].text.trimEnd();
		words[lastIdx].endsWithSpace = false;

		return words;
	}

	private getAttr(
		element: Element,
		ns: string,
		localName: string,
		fallbackAttrName?: string,
	): string | null {
		const val = element.getAttributeNS(ns, localName);
		if (val) return val;

		if (fallbackAttrName) {
			const fallbackVal = element.getAttribute(fallbackAttrName);
			if (fallbackVal) return fallbackVal;
		}

		if (element.hasAttributes()) {
			const attributes = Array.from(element.attributes);
			for (const attr of attributes) {
				const attrLocalName = attr.localName || attr.nodeName.split(":").pop();

				if (attrLocalName === localName) {
					return attr.value;
				}
			}
		}

		return null;
	}
}
