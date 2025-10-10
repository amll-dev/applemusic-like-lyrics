import { isLyricPageOpenedAtom } from "@applemusic-like-lyrics/react-full";
import { CameraIcon, Cross1Icon, StopIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import save from "save-file";
import { recordPanelOpenedAtom } from "../../states/appAtoms";
import styles from "./index.module.css";

const PreviewVideo = (props: { mediaStream: MediaStream }) => {
	const videoRef = useRef<HTMLVideoElement>(null);

	useLayoutEffect(() => {
		if (!videoRef.current) return;
		videoRef.current.srcObject = props.mediaStream;
	}, [props.mediaStream]);

	return (
		<video
			className={styles.preview}
			autoPlay
			playsInline
			muted
			ref={videoRef}
		/>
	);
};

export const RecordPanel = () => {
	const lyricOpened = useAtomValue(isLyricPageOpenedAtom);
	const [mediaStream, setMediaStream] = useState<MediaStream | undefined>(
		undefined,
	);
	const [recordPanelOpened, setRecordPanelOpened] = useAtom(
		recordPanelOpenedAtom,
	);
	const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | undefined>(
		undefined,
	);

	useLayoutEffect(() => {
		if (!lyricOpened) return;
		if (!recordPanelOpened) return;
		const amllEl = document.getElementById("amll-lyric-player");
		if (!amllEl) return;

		const mediaTask = (async () => {
			const restricter = await RestrictionTarget.fromElement(amllEl);
			const media = await navigator.mediaDevices.getDisplayMedia({
				video: {
					frameRate: {
						max: 120,
					},
					cursor: "never",
					displaySurface: "browser",
				},
			});
			const [track] = media.getVideoTracks();
			await track.restrictTo(restricter);
			setMediaStream(media);
			return media;
		})();

		return () => {
			mediaTask.then((stream) => {
				stream.getTracks().forEach((track) => {
					track.stop();
				});
				setMediaStream(undefined);
			});
		};
	}, [recordPanelOpened, lyricOpened]);

	return (
		<AnimatePresence>
			<div className={styles.recordPanelContainer}>
				{recordPanelOpened && mediaStream && (
					<motion.div
						className={styles.recordPanel}
						layout
						initial={{
							transform: "scale(0.8)",
							opacity: 0,
						}}
						animate={{
							transform: "scale(1)",
							opacity: 1,
							transition: {
								type: "spring",
								damping: 15,
							},
						}}
						exit={{
							transform: "scale(0.8)",
							opacity: 0,
						}}
					>
						<button
							type="button"
							onClick={async () => {
								if (!mediaStream) return;
								const [track] = mediaStream.getVideoTracks();

								// 让鼠标脱离当前页面，避免截图时被截取到
								const activeEl = document.activeElement;
								if (activeEl instanceof HTMLElement) {
									activeEl.blur();
								}
								const cp = new ImageCapture(track);
								const photo: ImageBitmap = await cp.grabFrame();
								const canvas = document.createElement("canvas");
								canvas.width = photo.width;
								canvas.height = photo.height;
								const ctx = canvas.getContext("bitmaprenderer");
								if (!ctx) {
									toast.error("无法获取画布上下文，请稍后再试。");
									return;
								}
								ctx.transferFromImageBitmap(photo);
								canvas.toBlob((blob) => {
									if (!blob) {
										toast.error("无法从画布创建图片数据。");
										return;
									}
									navigator.clipboard
										.write([
											new ClipboardItem({
												"image/png": blob,
											}),
										])
										.then(() => {
											toast.success("图片已复制到剪贴板");
										})
										.catch((err) => {
											toast.error("复制图片失败：", err);
										});
								});
							}}
						>
							<CameraIcon />
						</button>
						<button
							type="button"
							onClick={() => {
								if (mediaRecorder !== undefined) {
									mediaRecorder.stop();
									setMediaRecorder(undefined);
									return;
								}
								if (mediaStream === undefined) return;
								const recorder = new MediaRecorder(mediaStream, {
									videoBitsPerSecond: 20000000,
									mimeType: "video/mp4",
								});
								recorder.ondataavailable = (e) => {
									if (e.data.size === 0) return;
									save(e.data, `AMLL-Player-${new Date().toISOString()}.mp4`);
								};
								recorder.onstop = () => {
									setMediaRecorder(undefined);
								};
								recorder.onerror = (e) => {
									toast.error(`录制失败：${e.error.message}`);
									setMediaRecorder(undefined);
								};
								recorder.start();
								setMediaRecorder(recorder);
							}}
							style={
								mediaRecorder === undefined
									? {}
									: {
											backgroundColor: "var(--red-9)",
										}
							}
						>
							{mediaRecorder === undefined && (
								<span
									style={{
										width: "1em",
										height: "1em",
										borderRadius: "50%",
										backgroundColor: "var(--red-9)",
									}}
								/>
							)}
							{mediaRecorder !== undefined && <StopIcon />}
						</button>
						<PreviewVideo mediaStream={mediaStream} />
						<button
							type="button"
							onClick={() => {
								setRecordPanelOpened(false);
							}}
						>
							<Cross1Icon />
						</button>
					</motion.div>
				)}
			</div>
		</AnimatePresence>
	);
};
