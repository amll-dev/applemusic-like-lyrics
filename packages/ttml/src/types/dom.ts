/**
 * 为了兼容 xmldom 和原生 dom 而定义的最小化类型
 * @module dom-types
 * @internal
 */

export interface MinimalNode {
	readonly nodeType: number;
	textContent: string | null;
	readonly childNodes: ArrayLike<MinimalNode> | Iterable<MinimalNode>;
	readonly localName?: string | null;
	readonly tagName?: string;
	readonly nodeName?: string;
}

export interface MinimalAttribute {
	localName?: string | null;
	nodeName: string;
	value: string;
}

export interface MinimalElement extends MinimalNode {
	readonly localName: string | null;
	readonly tagName: string;
	readonly attributes: ArrayLike<MinimalAttribute> | Iterable<MinimalAttribute>;

	getAttribute(name: string): string | null;
	getAttributeNS(namespace: string | null, localName: string): string | null;
	hasAttributes(): boolean;

	setAttribute(name: string, value: string): void;
	setAttributeNS(
		namespace: string | null,
		qualifiedName: string,
		value: string,
	): void;

	getElementsByTagName(
		name: string,
	): ArrayLike<MinimalElement> | Iterable<MinimalElement>;
	getElementsByTagNameNS(
		namespaceURI: string,
		localName: string,
	): ArrayLike<MinimalElement> | Iterable<MinimalElement>;

	appendChild(node: MinimalNode): MinimalNode;
}

export interface MinimalDocument extends MinimalNode {
	readonly documentElement: MinimalElement | null;
	getElementsByTagName(
		name: string,
	): ArrayLike<MinimalElement> | Iterable<MinimalElement>;
	createElement(tagName: string): MinimalElement;
	createElementNS(
		namespaceURI: string | null,
		qualifiedName: string,
	): MinimalElement;
	createTextNode(data: string): MinimalNode;
}

export interface MinimalDOMParser {
	parseFromString(
		string: string,
		type: DOMParserSupportedType | string,
	): MinimalDocument;
}

export interface MinimalDOMImplementation {
	createDocument(
		namespaceURI: string | null,
		qualifiedName: string | null,
		doctype?: MinimalNode | null,
	): MinimalDocument;
}

export interface MinimalXMLSerializer {
	serializeToString(root: MinimalNode): string;
}
