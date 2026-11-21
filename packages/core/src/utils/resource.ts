const imageInFlight = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(imageUrl: string): Promise<HTMLImageElement> {
	// 同一张封面常被多个渲染器同时请求，共用加载中的 Promise 可以省掉重复解码；
	// 完成后立刻移除，不长期持有解码后的图片。
	const inFlight = imageInFlight.get(imageUrl);
	if (inFlight) return inFlight;

	const task = new Promise<HTMLImageElement>((resolve, reject) => {
		const img = document.createElement("img");
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = imageUrl;
		img.crossOrigin = "anonymous";
		img.loading = "eager";
	});

	imageInFlight.set(imageUrl, task);
	// 用 then 的拒绝分支而不是 finally，避免派生出一个未处理的拒绝
	task.then(
		() => imageInFlight.delete(imageUrl),
		() => imageInFlight.delete(imageUrl),
	);
	return task;
}

export function loadVideo(videoUrl: string): Promise<HTMLVideoElement> {
	return new Promise((resolve, reject) => {
		const video = document.createElement("video");
		let playing = false;
		let timeupdate = false;
		let rejected = false;
		video.addEventListener(
			"playing",
			() => {
				playing = true;
				checkReady();
			},
			true,
		);
		video.addEventListener(
			"timeupdate",
			() => {
				timeupdate = true;
				checkReady();
			},
			true,
		);
		video.addEventListener(
			"error",
			(err) => {
				rejected = true;
				reject(err);
			},
			true,
		);
		function checkReady() {
			if (playing && timeupdate && !rejected) {
				resolve(video);
			}
		}
		video.src = videoUrl;
		video.playsInline = true;
		video.crossOrigin = "anonymous";
		video.autoplay = true;
		video.loop = true;
		video.muted = true;
		video.play();
	});
}

export function loadResourceFromUrl(
	url: string,
	isVideo = false,
): Promise<HTMLImageElement | HTMLVideoElement> {
	return isVideo ? loadVideo(url) : loadImage(url);
}

export function loadResourceFromElement(
	element: HTMLImageElement | HTMLVideoElement,
): Promise<HTMLImageElement | HTMLVideoElement> {
	return new Promise((resolve, reject) => {
		if (
			element instanceof HTMLImageElement
				? element.complete
				: element.readyState >= 3
		) {
			resolve(element);
		} else {
			element.onload = () => resolve(element);
			element.onerror = reject;
		}
	});
}
