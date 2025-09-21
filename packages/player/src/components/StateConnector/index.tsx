import {
	isRepeatEnabledAtom,
	isShuffleActiveAtom,
	isShuffleEnabledAtom,
	onCycleRepeatModeAtom,
	onToggleShuffleAtom,
	RepeatMode,
	repeatModeAtom,
} from "@applemusic-like-lyrics/react-full";
import { invoke } from "@tauri-apps/api/core";
import { useAtom, useSetAtom, useStore } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MusicContextMode, musicContextModeAtom } from "../../states/appAtoms";
import {
	SmtcControls,
	smtcControlsAtom,
	smtcRepeatModeAtom,
	smtcShuffleStateAtom,
} from "../../states/smtcAtoms";

export const StateConnector = () => {
	const store = useStore();
	const { t } = useTranslation();
	const [mode] = useAtom(musicContextModeAtom);
	const [isSmtcShuffleOn] = useAtom(smtcShuffleStateAtom);
	const [smtcRepeat] = useAtom(smtcRepeatModeAtom);

	const setUiIsShuffleActive = useSetAtom(isShuffleActiveAtom);
	const setUiRepeatMode = useSetAtom(repeatModeAtom);
	const setUiShuffleEnabled = useSetAtom(isShuffleEnabledAtom);
	const setUiRepeatEnabled = useSetAtom(isRepeatEnabledAtom);

	const setOnToggleShuffle = useSetAtom(onToggleShuffleAtom);
	const setOnCycleRepeat = useSetAtom(onCycleRepeatModeAtom);

	useEffect(() => {
		const isSmtcMode = mode === MusicContextMode.SystemListener;

		if (isSmtcMode) {
			setUiIsShuffleActive(isSmtcShuffleOn);
			setUiRepeatMode(smtcRepeat);
			setUiShuffleEnabled(true);
			setUiRepeatEnabled(true);

			setOnToggleShuffle({
				onEmit: () => {
					const controls = store.get(smtcControlsAtom);
					if (!(controls & SmtcControls.CAN_CHANGE_SHUFFLE)) {
						toast.info(
							t(
								"amll.systemListener.shuffleNotAvailable",
								"当前应用不支持切换随机播放",
							),
						);
						return;
					}

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
					const controls = store.get(smtcControlsAtom);
					if (!(controls & SmtcControls.CAN_CHANGE_REPEAT)) {
						toast.info(
							t(
								"amll.systemListener.repeatNotAvailable",
								"当前应用不支持切换循环模式",
							),
						);
						return;
					}

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
		}

		return () => {
			if (!isSmtcMode) {
				const doNothing = { onEmit: () => {} };
				setOnToggleShuffle(doNothing);
				setOnCycleRepeat(doNothing);
			}
		};
	}, [
		mode,
		isSmtcShuffleOn,
		smtcRepeat,
		setUiIsShuffleActive,
		setUiRepeatMode,
		setUiShuffleEnabled,
		setUiRepeatEnabled,
		setOnToggleShuffle,
		setOnCycleRepeat,
		store,
		t,
	]);

	return null;
};
