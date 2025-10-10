import {
	hideLyricViewAtom,
	isLyricPageOpenedAtom,
	musicIdAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestPrevSongAtom,
} from "@applemusic-like-lyrics/react-full";
import { ContextMenu } from "@radix-ui/themes";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { FC } from "react";
import { Trans } from "react-i18next";
import { router } from "../../router.tsx";
import { recordPanelOpenedAtom } from "../../states/appAtoms.ts";

export const AMLLContextMenuContent: FC = () => {
	const [hideLyricView, setHideLyricView] = useAtom(hideLyricViewAtom);
	const setLyricPageOpened = useSetAtom(isLyricPageOpenedAtom);
	const setRecordPanelOpened = useSetAtom(recordPanelOpenedAtom);
	const onRequestPrevSong = useAtomValue(onRequestPrevSongAtom).onEmit;
	const onRequestNextSong = useAtomValue(onRequestNextSongAtom).onEmit;
	const onPlayOrResume = useAtomValue(onPlayOrResumeAtom).onEmit;
	const musicId = useAtomValue(musicIdAtom);

	return (
		<ContextMenu.Content>
			<ContextMenu.Item onClick={onRequestPrevSong} shortcut="Ctrl Alt ←">
				<Trans i18nKey="amll.contextMenu.rewindSong">上一首</Trans>
			</ContextMenu.Item>
			<ContextMenu.Item onClick={onPlayOrResume} shortcut="Ctrl Alt P">
				<Trans i18nKey="amll.contextMenu.pauseOrResume">暂停 / 继续</Trans>
			</ContextMenu.Item>
			<ContextMenu.Item onClick={onRequestNextSong} shortcut="Ctrl Alt →">
				<Trans i18nKey="amll.contextMenu.forwardSong">下一首</Trans>
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item
				onClick={async () => {
					const win = getCurrentWindow();
					const isFullscreen = await win.isFullscreen();
					setSystemTitlebarFullscreen(!isFullscreen);
					await win.setFullscreen(!isFullscreen);
				}}
			>
				<Trans i18nKey="amll.contextMenu.toggleFullscreen">
					全屏 / 取消全屏
				</Trans>
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.CheckboxItem
				checked={!hideLyricView}
				onCheckedChange={(e) => setHideLyricView(!e)}
			>
				<Trans i18nKey="amll.contextMenu.toggleLyrics">显示歌词</Trans>
			</ContextMenu.CheckboxItem>
			<ContextMenu.Item
				onClick={() => {
					setLyricPageOpened(false);
					router.navigate(`/song/${musicId}`);
				}}
			>
				<Trans i18nKey="amll.contextMenu.editMusicOverrideMessage">
					编辑歌曲覆盖信息
				</Trans>
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item
				onClick={() => {
					setRecordPanelOpened(true);
				}}
			>
				<Trans i18nKey="amll.contextMenu.openRecorder">打开捕获面板</Trans>
			</ContextMenu.Item>
			<ContextMenu.Item
				onClick={() => {
					invoke("open_screenshot_window");
				}}
			>
				<Trans i18nKey="amll.contextMenu.openScreenshotTool">
					打开截图工具
				</Trans>
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item
				onClick={() => {
					setLyricPageOpened(false);
				}}
			>
				<Trans i18nKey="amll.contextMenu.exitLyricPage">退出歌词页面</Trans>
			</ContextMenu.Item>
		</ContextMenu.Content>
	);
};
