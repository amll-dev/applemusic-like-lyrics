export type HttpMethod = "GET" | "POST";

export interface ApiParam {
	name: string;
	type: "string" | "number" | "boolean";
	required: boolean;
	placeholder?: string;
}

export interface ApiEndpointDef {
	/**
	 * 唯一标识符，用于触发器绑定
	 */
	id: string;
	/**
	 * 请求路径，例如 `/v1/lyrics/search` 或 `/v1/lrclib/get/{id}`
	 */
	path: string;
	method: HttpMethod;
	/**
	 * 是否需要 Bearer Token
	 */
	authRequired: boolean;
	/**
	 * 路径参数定义，例如 `{id}`
	 */
	pathParams?: ApiParam[];
	params: ApiParam[];
}

export const API_BASE_URL = "https://api.amll.dev";

export const API_CONFIG: Record<string, ApiEndpointDef> = {
	getLyric: {
		id: "getLyric",
		path: "/v1/lyrics/get",
		method: "GET",
		authRequired: false,
		params: [
			{
				name: "id",
				type: "number",
				required: false,
				placeholder: "269710089745311",
			},
			{
				name: "filename",
				type: "string",
				required: false,
				placeholder: "1768754400682-250306205-r6IrpmBd.ttml",
			},
			{
				name: "ncmMusicId",
				type: "string",
				required: false,
				placeholder: "1361348080",
			},
			{
				name: "qqMusicId",
				type: "string",
				required: false,
				placeholder: "0032UZe62rZk9K",
			},
			{
				name: "appleMusicId",
				type: "string",
				required: false,
				placeholder: "1468058706",
			},
			{
				name: "spotifyId",
				type: "string",
				required: false,
				placeholder: "2Rk4JlNc2TPmZe2af99d45",
			},
			{
				name: "isrc",
				type: "string",
				required: false,
				placeholder: "USUG11901494",
			},
			{
				name: "format",
				type: "string",
				required: false,
				placeholder: "ttml",
			},
		],
	},
	searchLyrics: {
		id: "searchLyrics",
		path: "/v1/lyrics/search",
		method: "GET",
		authRequired: false,
		params: [
			{
				name: "q",
				type: "string",
				required: false,
				placeholder: "ME!",
			},
			{
				name: "musicName",
				type: "string",
				required: false,
				placeholder: "ME!",
			},
			{
				name: "artistName",
				type: "string",
				required: false,
				placeholder: "Taylor Swift",
			},
			{
				name: "albumName",
				type: "string",
				required: false,
				placeholder: "Lover",
			},
			{
				name: "lyricText",
				type: "string",
				required: false,
				placeholder: "handful",
			},
			{
				name: "authorId",
				type: "string",
				required: false,
				placeholder: "50747104",
			},
			{
				name: "authorUsername",
				type: "string",
				required: false,
				placeholder: "Xionghaizi001",
			},
			{
				name: "page",
				type: "number",
				required: false,
				placeholder: "1",
			},
			{
				name: "pageSize",
				type: "number",
				required: false,
				placeholder: "50",
			},
		],
	},
	syncWebhook: {
		id: "syncWebhook",
		path: "/v1/webhook/sync",
		method: "POST",
		authRequired: true,
		params: [],
	},
	getStatus: {
		id: "getStatus",
		path: "/v1/status",
		method: "GET",
		authRequired: false,
		params: [],
	},
	lrclibSearch: {
		id: "lrclibSearch",
		path: "/v1/lrclib/search",
		method: "GET",
		authRequired: false,
		params: [
			{
				name: "q",
				type: "string",
				required: false,
				placeholder: "ME!",
			},
			{
				name: "track_name",
				type: "string",
				required: false,
				placeholder: "ME!",
			},
			{
				name: "artist_name",
				type: "string",
				required: false,
				placeholder: "Taylor Swift",
			},
			{
				name: "album_name",
				type: "string",
				required: false,
				placeholder: "Lover",
			},
			{
				name: "page",
				type: "number",
				required: false,
				placeholder: "1",
			},
			{
				name: "pageSize",
				type: "number",
				required: false,
				placeholder: "50",
			},
		],
	},
	lrclibGet: {
		id: "lrclibGet",
		path: "/v1/lrclib/get",
		method: "GET",
		authRequired: false,
		params: [
			{
				name: "track_name",
				type: "string",
				required: true,
				placeholder: "ME!",
			},
			{
				name: "artist_name",
				type: "string",
				required: true,
				placeholder: "Taylor Swift",
			},
			{
				name: "album_name",
				type: "string",
				required: false,
				placeholder: "Lover",
			},
			{
				name: "duration",
				type: "number",
				required: false,
				placeholder: "185.8",
			},
		],
	},
	lrclibGetById: {
		id: "lrclibGetById",
		path: "/v1/lrclib/get/{id}",
		method: "GET",
		authRequired: false,
		pathParams: [
			{
				name: "id",
				type: "number",
				required: true,
				placeholder: "269710089745311",
			},
		],
		params: [],
	},
};
