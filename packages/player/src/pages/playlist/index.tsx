import {
	ArrowLeftIcon,
	Pencil1Icon,
	PlayIcon,
	PlusIcon,
} from "@radix-ui/react-icons";
import {
	Box,
	Button,
	ContextMenu,
	Flex,
	Heading,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { path } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, useMotionTemplate, useScroll } from "framer-motion";
import md5 from "md5";
import { type FC, useCallback, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ViewportList } from "react-viewport-list";
import { PageContainer } from "../../components/PageContainer/index.tsx";
import { PlaylistCover } from "../../components/PlaylistCover/index.tsx";
import { PlaylistSongCard } from "../../components/PlaylistSongCard/index.tsx";
import { db, type Song } from "../../dexie.ts";
import { emitAudioThread, readLocalMusicMetadata } from "../../utils/player.ts";
import styles from "./index.module.css";

export type Loadable<Value> =
	| {
			state: "loading";
	  }
	| {
			state: "hasError";
			error: unknown;
	  }
	| {
			state: "hasData";
			data: Awaited<Value>;
	  };

const EditablePlaylistName: FC<{
	playlistName: string;
	onPlaylistNameChange: (newName: string) => void;
}> = ({ playlistName, onPlaylistNameChange }) => {
	const [editing, setEditing] = useState(false);
	const [newName, setNewName] = useState(playlistName);

	return (
		<Heading className={styles.title}>
			{!editing && playlistName}
			{!editing && (
				<IconButton
					ml="2"
					style={{
						verticalAlign: "middle",
					}}
					size="1"
					variant="ghost"
					onClick={() => {
						setNewName(playlistName);
						setEditing(true);
					}}
				>
					<Pencil1Icon />
				</IconButton>
			)}
			{editing && (
				<TextField.Root
					value={newName}
					autoFocus
					onChange={(e) => setNewName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							if (newName !== playlistName) onPlaylistNameChange(newName);
							setEditing(false);
						}
					}}
					onBlur={() => {
						if (newName !== playlistName) onPlaylistNameChange(newName);
						setEditing(false);
					}}
				/>
			)}
		</Heading>
	);
};

export const Component: FC = () => {
	const param = useParams();
	const playlist = useLiveQuery(() => db.playlists.get(Number(param.id)));
	const { t } = useTranslation();
	const playlistViewRef = useRef<HTMLDivElement>(null);
	const playlistViewScroll = useScroll({
		container: playlistViewRef,
	});
	const playlistCoverSize = useMotionTemplate`clamp(6em,calc(12em - ${playlistViewScroll.scrollY}px),12em)`;
	const playlistInfoGapSize = useMotionTemplate`clamp(var(--space-1), calc(var(--space-4) - ${playlistViewScroll.scrollY}px / 5), var(--space-4))`;

	const onAddLocalMusics = useCallback(async () => {
		let filters = [
			{
				name: t("page.playlist.addLocalMusic.filterName", "音频文件"),
				extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg"],
			},
			{
				name: t("page.playlist.addLocalMusic.allFiles", "所有文件"),
				extensions: ["*"],
			},
		];
		if (platform() === "android") {
			filters = [
				{
					name: t("page.playlist.addLocalMusic.filterName", "音频文件"),
					extensions: ["audio/*"],
				},
				{
					name: t("page.playlist.addLocalMusic.allFiles", "所有文件"),
					extensions: ["*/*"],
				},
			];
		}
		if (platform() === "ios") {
			filters.length = 0;
		}
		const results = await open({
			multiple: true,
			title: "选择本地音乐",
			filters,
		});
		if (!results) return;
		console.log(results);
		const id = toast.loading(
			t(
				"page.playlist.addLocalMusic.toast.parsingMusicMetadata",
				"正在解析音乐元数据以添加歌曲 ({current, plural, other {#}} / {total, plural, other {#}})",
				{
					current: 0,
					total: results.length,
				},
			),
		);
		let current = 0;
		let success = 0;
		let errored = 0;
		const transformed = (
			await Promise.all(
				results.map(async (v) => {
					let normalized = v;
					console.log(v);
					if (platform() !== "android" && platform() !== "ios") {
						normalized = (await path.normalize(v)).replace(/\\/gi, "/");
					}
					try {
						console.log(await stat(v));
						const pathMd5 = md5(normalized);
						const musicInfo = await readLocalMusicMetadata(normalized);

						const coverData = new Uint8Array(musicInfo.cover);
						const coverBlob = new Blob([coverData], { type: "image" });

						success += 1;
						return {
							id: pathMd5,
							filePath: normalized,
							songName: musicInfo.name,
							songArtists: musicInfo.artist,
							songAlbum: musicInfo.album,
							lyricFormat: musicInfo.lyricFormat || "none",
							lyric: musicInfo.lyric,
							cover: coverBlob,
							duration: musicInfo.duration,
						} satisfies Song;
					} catch (err) {
						errored += 1;
						console.warn("解析歌曲元数据以添加歌曲失败", normalized, err);
						return null;
					} finally {
						current += 1;
						toast.update(id, {
							render: t(
								"page.playlist.addLocalMusic.toast.parsingMusicMetadata",
								"正在解析音乐元数据以添加歌曲 ({current, plural, other {#}} / {total, plural, other {#}})",
								{
									current: 0,
									total: results.length,
								},
							),
							progress: current / results.length,
						});
					}
				}),
			)
		).filter((v) => !!v);
		await db.songs.bulkPut(transformed);
		const shouldAddIds = transformed
			.map((v) => v.id)
			.filter((v) => !playlist?.songIds.includes(v))
			.reverse();
		await db.playlists.update(Number(param.id), (obj) => {
			obj.songIds.unshift(...shouldAddIds);
		});
		toast.done(id);
		if (errored > 0 && success > 0) {
			toast.warn(
				t(
					"page.playlist.addLocalMusic.toast.partiallyFailed",
					"已添加 {succeed, plural, other {#}} 首歌曲，其中 {errored, plural, other {#}} 首歌曲添加失败",
					{
						succeed: success,
						errored,
					},
				),
			);
		} else if (success === 0) {
			toast.error(
				t(
					"page.playlist.addLocalMusic.toast.allFailed",
					"{errored, plural, other {#}} 首歌曲添加失败",
					{
						errored,
					},
				),
			);
		} else {
			toast.success(
				t(
					"page.playlist.addLocalMusic.toast.success",
					"已全部添加 {count, plural, other {#}} 首歌曲",
					{
						count: success,
					},
				),
			);
		}
	}, [playlist, param.id, t]);

	const onPlayList = useCallback(
		async (songIndex = 0, shuffle = false) => {
			if (playlist === undefined) return;
			const collected = await db.songs
				.toCollection()
				.filter((v) => playlist.songIds.includes(v.id))
				.toArray();
			if (shuffle) {
				for (let i = 0; i < collected.length; i++) {
					const j = Math.floor(Math.random() * (i + 1));
					[collected[i], collected[j]] = [collected[j], collected[i]];
				}
			} else {
				collected.sort((a, b) => {
					return (
						playlist.songIds.indexOf(a.id) - playlist.songIds.indexOf(b.id)
					);
				});
			}
			await emitAudioThread("setPlaylist", {
				songs: collected.map((v, i) => ({
					type: "local",
					filePath: v.filePath,
					origOrder: i,
				})),
			});
			await emitAudioThread("jumpToSong", {
				songIndex,
			});
		},
		[playlist],
	);

	const onDeleteSong = useCallback(
		async (songId: string) => {
			if (playlist === undefined) return;
			await db.playlists.update(Number(param.id), (obj) => {
				obj.songIds = obj.songIds.filter((v) => v !== songId);
			});
		},
		[playlist, param.id],
	);

	const onPlaylistDefault = useCallback(onPlayList.bind(null, 0), [onPlayList]);
	const onPlaylistShuffle = useMemo(
		() => onPlayList.bind(null, 0, true),
		[onPlayList],
	);

	return (
		<PageContainer>
			<Flex direction="column" height="100%">
				<Flex gap="4" direction="column" flexGrow="0" pb="4" mt="5">
					<Flex align="end" pt="4">
						<Button variant="soft" onClick={() => history.back()}>
							<ArrowLeftIcon />
							<Trans i18nKey="common.page.back">返回</Trans>
						</Button>
					</Flex>
					<Flex align="end" gap="3">
						<motion.div
							style={{
								width: playlistCoverSize,
							}}
						>
							<ContextMenu.Root>
								<ContextMenu.Trigger>
									<PlaylistCover
										playlistId={Number(param.id)}
										style={{
											width: "100%",
										}}
									/>
								</ContextMenu.Trigger>
								<ContextMenu.Content>
									<ContextMenu.Item
										onClick={() => {
											db.playlists.update(Number(param.id), (obj) => {
												obj.playlistCover = undefined;
											});
										}}
									>
										<Trans i18nKey="page.playlist.cover.changeCoverToAuto">
											更换成自动封面
										</Trans>
									</ContextMenu.Item>
									<ContextMenu.Item
										onClick={() => {
											const inputEl = document.createElement("input");
											inputEl.type = "file";
											inputEl.accept = "image/*";
											inputEl.addEventListener(
												"change",
												() => {
													const file = inputEl.files?.[0];
													if (!file) return;
													db.playlists.update(Number(param.id), (obj) => {
														obj.playlistCover = file;
													});
												},
												{
													once: true,
												},
											);
											inputEl.click();
										}}
									>
										<Trans i18nKey="page.playlist.cover.uploadCoverImage">
											上传封面图片
										</Trans>
									</ContextMenu.Item>
								</ContextMenu.Content>
							</ContextMenu.Root>
						</motion.div>
						<Flex
							direction="column"
							display={{
								initial: "none",
								sm: "flex",
							}}
							gap={playlistInfoGapSize.get()}
							asChild
						>
							<motion.div
								style={{
									gap: playlistInfoGapSize,
								}}
							>
								<EditablePlaylistName
									playlistName={playlist?.name || ""}
									onPlaylistNameChange={(newName) =>
										db.playlists.update(Number(param.id), (obj) => {
											obj.name = newName;
										})
									}
								/>
								<Text>
									{t(
										"page.playlist.totalMusicLabel",
										"{count, plural, other {#}} 首歌曲",
										{
											count: playlist?.songIds?.length || 0,
										},
									)}
								</Text>
								<Flex gap="2">
									<Button onClick={() => onPlaylistDefault()}>
										<PlayIcon />
										<Trans i18nKey="page.playlist.playAll">播放全部</Trans>
									</Button>
									<Button variant="soft" onClick={onPlaylistShuffle}>
										<Trans i18nKey="page.playlist.shufflePlayAll">
											随机播放
										</Trans>
									</Button>
									<Button variant="soft" onClick={onAddLocalMusics}>
										<PlusIcon />
										<Trans i18nKey="page.playlist.addLocalMusic.label">
											添加本地歌曲
										</Trans>
									</Button>
								</Flex>
							</motion.div>
						</Flex>
						<Flex
							direction="column"
							display={{
								xs: "flex",
								sm: "none",
							}}
							asChild
						>
							<motion.div
								style={{
									gap: playlistInfoGapSize,
								}}
							>
								<EditablePlaylistName
									playlistName={playlist?.name || ""}
									onPlaylistNameChange={(newName) =>
										db.playlists.update(Number(param.id), (obj) => {
											obj.name = newName;
										})
									}
								/>
								<Text>
									{t(
										"page.playlist.totalMusicLabel",
										"{count, plural, other {#}} 首歌曲",
										{
											count: playlist?.songIds?.length || 0,
										},
									)}
								</Text>
								<Flex gap="2">
									<IconButton onClick={() => onPlaylistDefault()}>
										<PlayIcon />
									</IconButton>
									<IconButton variant="soft" onClick={onAddLocalMusics}>
										<PlusIcon />
									</IconButton>
								</Flex>
							</motion.div>
						</Flex>
					</Flex>
				</Flex>
				<Box
					flexGrow="1"
					overflowY="auto"
					minHeight="0"
					pb="4"
					ref={playlistViewRef}
				>
					{playlist?.songIds && (
						<ViewportList
							items={playlist.songIds}
							viewportRef={playlistViewRef}
						>
							{(songId, index) => (
								<PlaylistSongCard
									key={`playlist-song-card-${songId}`}
									songId={songId}
									songIndex={index}
									onPlayList={onPlayList}
									onDeleteSong={onDeleteSong}
								/>
							)}
						</ViewportList>
					)}
				</Box>
			</Flex>
		</PageContainer>
	);
};

Component.displayName = "PlaylistPage";

export default Component;
