import type { TTMLLyric } from "@applemusic-like-lyrics/lyric";
import { parseTTML } from "@applemusic-like-lyrics/lyric";
import chalk from "chalk";
import type { Store } from "jotai/vanilla/store";
import JSZip from "jszip";
import pLimit from "p-limit";
import { db } from "../dexie";
import { lyricDBVersionAtom } from "../states/appAtoms";

/**
 * 同步结果
 */
export enum SyncStatus {
	/**
	 * 因版本一致而跳过
	 */
	Skipped = "SKIPPED",
	/**
	 * 发现新版本并成功更新
	 */
	Updated = "UPDATED",
	/**
	 * 词库的 Release 没有数据或者解压出来是空的
	 */
	Empty = "EMPTY",
	/**
	 * 发生了错误
	 */
	Failed = "FAILED",
	/**
	 * 被其他标签页锁定
	 */
	Locked = "LOCKED",
}

/**
 * `syncLyricsDatabase` 用来表示返回值的接口
 */
export interface SyncResult {
	status: SyncStatus;
	count?: number;
	error?: unknown;
	strategy?: "full" | "incremental";
}

/**
 * 词库 Release 中 `version.json` 的结构
 */
interface RemoteVersion {
	build_date: string;
	commit: string;
	file_count: number;
	timestamp: number;
}

interface IndexEntry {
	rawLyricFile: string;
	// metadata: unknown; // 暂时不用
}

const INCREMENTAL_THRESHOLD = 200;

const TTML_LOG_TAG = chalk.bgHex("#FF5577").hex("#FFFFFF")(" TTML DB ");

const MIRROR_BASE = "https://amlldb.bikonoo.com";

const getMirrorIndexUrl = (): string => {
	return `${MIRROR_BASE}/metadata/raw-lyrics-index.jsonl`;
};

const getMirrorLyricUrl = (fileName: string): string => {
	return `${MIRROR_BASE}/raw-lyrics/${fileName}`;
};

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
	for (let i = 0; i < retries; i++) {
		try {
			const res = await fetch(url);

			if (res.ok) return res;

			if (res.status === 404) {
				throw new Error("ABORT_RETRY_404");
			}

			if (res.status >= 500) {
				throw new Error(`HTTP Server Error ${res.status}`);
			}

			throw new Error(`HTTP Error ${res.status}`);
		} catch (err) {
			if (
				(err as Error).message === "ABORT_RETRY_404" ||
				(err as Error).message === "404 Not Found"
			) {
				throw new Error("404 Not Found");
			}

			if (i === retries - 1) throw err;
		}

		await new Promise((r) => setTimeout(r, 500 * (i + 1)));
	}
	throw new Error("重试后仍然失败");
}

export async function syncLyricsDatabase(store: Store): Promise<SyncResult> {
	return navigator.locks.request(
		"lyric-sync-lock",
		{ ifAvailable: true },
		async (lock) => {
			if (!lock) {
				console.log(TTML_LOG_TAG, "另一个标签页正在同步，跳过同步");
				return { status: SyncStatus.Locked };
			}

			try {
				const versionUrl = `${MIRROR_BASE}/raw-lyrics/version.json`;
				const versionRes = await fetch(versionUrl, { cache: "no-cache" });
				if (!versionRes.ok)
					throw new Error(`版本检查失败: ${versionRes.status}`);

				const remoteVersion: RemoteVersion = await versionRes.json();

				const localCommit = store.get(lyricDBVersionAtom);

				if (localCommit === remoteVersion.commit) {
					const count = await db.ttmlDB.count();
					if (count > 0) {
						console.log(TTML_LOG_TAG, "歌词库已是最新，无需更新。");
						return { status: SyncStatus.Skipped };
					}
				}

				console.log(
					TTML_LOG_TAG,
					`检测到新版本 (Local: ${localCommit?.slice(0, 7) || "None"} -> Remote: ${remoteVersion.commit.slice(0, 7)})，开始下载...`,
				);

				const localCount = await db.ttmlDB.count();
				let result: SyncResult;

				if (localCount === 0) {
					result = await performFullSync(store, remoteVersion.commit);
				} else {
					try {
						result = await performIncrementalSync(store, remoteVersion.commit);
					} catch (err) {
						console.warn(TTML_LOG_TAG, "增量更新失败:", err);
						result = await performFullSync(store, remoteVersion.commit);
					}
				}

				return result;
			} catch (error) {
				console.error(TTML_LOG_TAG, "同步歌词时发生错误:", error);
				return { status: SyncStatus.Failed, error };
			}
		},
	);
}

async function performFullSync(
	store: Store,
	commit: string,
): Promise<SyncResult> {
	const zipUrl = `${MIRROR_BASE}/raw-lyrics/raw-lyrics.zip`;

	const res = await fetch(zipUrl);
	if (!res.ok) throw new Error(`下载zip失败: ${res.status}`);

	const zipBlob = await res.blob();
	const zip = await JSZip.loadAsync(zipBlob);

	const lyricsToInsert: { name: string; content: TTMLLyric; raw: string }[] =
		[];
	const promises: Promise<void>[] = [];

	zip.forEach((relativePath, entry) => {
		if (entry.dir || !relativePath.endsWith(".ttml")) return;
		promises.push(
			(async () => {
				try {
					const raw = await entry.async("string");
					lyricsToInsert.push({
						name: relativePath,
						content: parseTTML(raw),
						raw: raw,
					});
				} catch (e) {
					console.warn(TTML_LOG_TAG, `解析歌词文件 ${relativePath} 失败:`, e);
				}
			})(),
		);
	});

	await Promise.all(promises);

	if (lyricsToInsert.length > 0) {
		await db.transaction("rw", db.ttmlDB, async () => {
			await db.ttmlDB.bulkPut(lyricsToInsert);
		});
		store.set(lyricDBVersionAtom, commit);
		return {
			status: SyncStatus.Updated,
			count: lyricsToInsert.length,
			strategy: "full",
		};
	}

	return { status: SyncStatus.Empty };
}

async function performIncrementalSync(
	store: Store,
	remoteCommit: string,
): Promise<SyncResult> {
	const indexUrl = getMirrorIndexUrl();
	console.log(TTML_LOG_TAG, "下载索引:", indexUrl);

	const indexRes = await fetchWithRetry(indexUrl);
	const indexText = await indexRes.text();

	const remoteFiles = new Set<string>();
	indexText.split("\n").forEach((line) => {
		if (!line.trim()) return;
		try {
			const entry: IndexEntry = JSON.parse(line);
			if (entry.rawLyricFile) remoteFiles.add(entry.rawLyricFile);
		} catch (e) {
			console.warn(TTML_LOG_TAG, `解析索引文件失败:`, e);
		}
	});

	const localKeys = await db.ttmlDB.toCollection().keys();
	const localFiles = new Set(localKeys);

	const toDownload: string[] = [];
	remoteFiles.forEach((file) => {
		if (!localFiles.has(file)) {
			toDownload.push(file);
		}
	});

	console.log(
		TTML_LOG_TAG,
		`需要下载 ${toDownload.length}, 远程有 ${remoteFiles.size}`,
	);

	if (toDownload.length > INCREMENTAL_THRESHOLD) {
		console.log(TTML_LOG_TAG, "转为全量下载", toDownload.length);
		return performFullSync(store, remoteCommit);
	}

	if (toDownload.length === 0) {
		store.set(lyricDBVersionAtom, remoteCommit);
		return { status: SyncStatus.Skipped, count: 0, strategy: "incremental" };
	}

	const limit = pLimit(20);
	const lyricsToInsert: { name: string; content: TTMLLyric; raw: string }[] =
		[];
	const errors: string[] = [];

	const tasks = toDownload.map((fileName) => {
		return limit(async () => {
			try {
				const rawUrl = getMirrorLyricUrl(fileName);
				const res = await fetchWithRetry(rawUrl);
				const raw = await res.text();

				lyricsToInsert.push({
					name: fileName,
					content: parseTTML(raw),
					raw: raw,
				});
			} catch (err) {
				errors.push(fileName);
				console.warn(TTML_LOG_TAG, `下载 ${fileName} 失败:`, err);
			}
		});
	});

	await Promise.all(tasks);

	if (lyricsToInsert.length > 0) {
		await db.transaction("rw", db.ttmlDB, async () => {
			await db.ttmlDB.bulkPut(lyricsToInsert);
		});

		store.set(lyricDBVersionAtom, remoteCommit);

		console.log(
			TTML_LOG_TAG,
			`增量同步 ${lyricsToInsert.length}, 失败 ${errors.length}`,
		);
		return {
			status: SyncStatus.Updated,
			count: lyricsToInsert.length,
			strategy: "incremental",
		};
	}

	return {
		status: SyncStatus.Failed,
		error: "所有文件都下载失败了",
	};
}
