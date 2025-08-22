import {
	isRepeatEnabledAtom,
	isShuffleActiveAtom,
	isShuffleEnabledAtom,
	musicPlayingPositionAtom,
	onCycleRepeatModeAtom,
	onToggleShuffleAtom,
	positionSourceAtom,
	RepeatMode,
	repeatModeAtom,
} from "@applemusic-like-lyrics/react-full";
import { invoke } from "@tauri-apps/api/core";
import { useAtom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { toast } from "react-toastify";

import { MusicContextMode, musicContextModeAtom } from "../../states/appAtoms";
import {
	correctedMusicPlayingPositionAtom as smtcCorrectedPositionAtom,
	smtcRepeatModeAtom,
	smtcShuffleStateAtom,
} from "../../states/smtcAtoms";

export const StateConnector = () => {
	const [mode] = useAtom(musicContextModeAtom);
	const [isSmtcShuffleOn] = useAtom(smtcShuffleStateAtom);
	const [smtcRepeat] = useAtom(smtcRepeatModeAtom);

	const setUiIsShuffleActive = useSetAtom(isShuffleActiveAtom);
	const setUiRepeatMode = useSetAtom(repeatModeAtom);
	const setUiShuffleEnabled = useSetAtom(isShuffleEnabledAtom);
	const setUiRepeatEnabled = useSetAtom(isRepeatEnabledAtom);

	useEffect(() => {
		const isSmtcMode = mode === MusicContextMode.SystemListener;

		if (isSmtcMode) {
			setUiIsShuffleActive(isSmtcShuffleOn);
			setUiRepeatMode(smtcRepeat);
		} else {
			setUiIsShuffleActive(false);
			setUiRepeatMode(RepeatMode.Off);
		}

		setUiShuffleEnabled(isSmtcMode);
		setUiRepeatEnabled(isSmtcMode);
	}, [
		mode,
		isSmtcShuffleOn,
		smtcRepeat,
		setUiIsShuffleActive,
		setUiRepeatMode,
		setUiShuffleEnabled,
		setUiRepeatEnabled,
	]);

	const setPositionSource = useSetAtom(positionSourceAtom);

	useEffect(() => {
		if (mode === MusicContextMode.SystemListener) {
			setPositionSource(smtcCorrectedPositionAtom);
		} else {
			setPositionSource(musicPlayingPositionAtom);
		}
	}, [mode, setPositionSource]);

	const setOnToggleShuffle = useSetAtom(onToggleShuffleAtom);
	const setOnCycleRepeat = useSetAtom(onCycleRepeatModeAtom);

	useEffect(() => {
		setOnToggleShuffle({
			onEmit: () => {
				const currentShuffleState = isSmtcShuffleOn;
				const newShuffleState = !currentShuffleState;

				invoke("control_external_media", {
					payload: { type: "setShuffle", is_active: newShuffleState },
				}).catch((err) => {
					console.error("设置随机播放失败:", err);
					toast.error("设置随机播放失败");
				});
			},
		});

		setOnCycleRepeat({
			onEmit: () => {
				const currentRepeatMode = smtcRepeat;
				const nextMode =
					currentRepeatMode === RepeatMode.Off
						? RepeatMode.All
						: currentRepeatMode === RepeatMode.All
							? RepeatMode.One
							: RepeatMode.Off;

				invoke("control_external_media", {
					payload: { type: "setRepeatMode", mode: nextMode },
				}).catch((err) => {
					console.error("设置循环模式失败:", err);
					toast.error("设置循环模式失败");
				});
			},
		});
	}, [setOnToggleShuffle, setOnCycleRepeat, isSmtcShuffleOn, smtcRepeat]);

	return null;
};
