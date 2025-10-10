import { branch, commit } from "virtual:git-metadata-plugin";
import {
	CanvasLyricPlayer,
	DomLyricPlayer,
	DomSlimLyricPlayer,
	MeshGradientRenderer,
	PixiRenderer,
} from "@applemusic-like-lyrics/core";
import {
	cssBackgroundPropertyAtom,
	enableLyricLineBlurEffectAtom,
	enableLyricLineScaleEffectAtom,
	enableLyricLineSpringAnimationAtom,
	enableLyricRomanLineAtom,
	enableLyricSwapTransRomanLineAtom,
	enableLyricTranslationLineAtom,
	fftDataRangeAtom,
	type LyricBackgroundRenderer,
	LyricPlayerImplementation,
	type LyricPlayerImplementationObject,
	LyricSizePreset,
	type LyricSizePresetValue,
	lyricBackgroundFPSAtom,
	lyricBackgroundRendererAtom,
	lyricBackgroundRenderScaleAtom,
	lyricBackgroundStaticModeAtom,
	lyricFontFamilyAtom,
	lyricFontWeightAtom,
	lyricLetterSpacingAtom,
	lyricPlayerImplementationAtom,
	lyricSizePresetAtom,
	lyricWordFadeWidthAtom,
	PlayerControlsType,
	playerControlsTypeAtom,
	showBottomControlAtom,
	showMusicAlbumAtom,
	showMusicArtistsAtom,
	showMusicNameAtom,
	showVolumeControlAtom,
	VerticalCoverLayout,
	verticalCoverLayoutAtom,
} from "@applemusic-like-lyrics/react-full";
import {
	Box,
	Button,
	Card,
	Flex,
	Select,
	Separator,
	Slider,
	type SliderProps,
	Switch,
	type SwitchProps,
	Text,
	TextField,
	type TextProps,
} from "@radix-ui/themes";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { atom, useAtom, useAtomValue, type WritableAtom } from "jotai";
import { loadable } from "jotai/utils";
import React, {
	type FC,
	type PropsWithChildren,
	type ReactNode,
	Suspense,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { router } from "../../router.tsx";
import {
	advanceLyricDynamicLyricTimeAtom,
	DarkMode,
	darkModeAtom,
	enableWsLyricsInSmtcModeAtom,
	showStatJSFrameAtom,
	updateInfoAtom,
} from "../../states/appAtoms.ts";
import {
	type SmtcSession,
	smtcSelectedSessionIdAtom,
	smtcSessionsAtom,
	smtcTextConversionModeAtom,
	smtcTimeOffsetAtom,
	TextConversionMode,
} from "../../states/smtcAtoms.ts";
import { restartApp } from "../../utils/player.ts";
import styles from "./index.module.css";

const SettingEntry: FC<
	PropsWithChildren<{ label: string; description?: string }>
> = ({ label, description, children }) => {
	return (
		<Card mt="2">
			<Flex direction="row" align="center" gap="4" wrap="wrap">
				<Flex direction="column" flexGrow="1">
					<Text as="div">{label}</Text>
					<Text as="div" color="gray" size="2" className={styles.desc}>
						{description}
					</Text>
				</Flex>
				{children}
			</Flex>
		</Card>
	);
};

const NumberSettings: FC<
	{ configAtom: WritableAtom<number, [number], void> } & React.ComponentProps<
		typeof SettingEntry
	> &
		Omit<React.ComponentProps<typeof TextField.Root>, "value" | "onChange">
> = ({ label, description, configAtom, ...props }) => {
	const [value, setValue] = useAtom(configAtom);
	return (
		<SettingEntry label={label} description={description}>
			<TextField.Root
				{...props}
				style={{ minWidth: "10em" }}
				defaultValue={String(value)}
				onChange={(e) => setValue(e.currentTarget.valueAsNumber || 0)}
			/>
		</SettingEntry>
	);
};

const SwitchSettings: FC<
	{ configAtom: WritableAtom<boolean, [boolean], void> } & React.ComponentProps<
		typeof SettingEntry
	> &
		Omit<SwitchProps, "value" | "onChange">
> = ({ label, description, configAtom }) => {
	const [value, setValue] = useAtom(configAtom);
	return (
		<SettingEntry label={label} description={description}>
			<Switch checked={value} onCheckedChange={setValue} />
		</SettingEntry>
	);
};

const SubTitle: FC<PropsWithChildren<TextProps>> = ({ children, ...props }) => {
	return (
		<Text weight="bold" size="7" my="4" as="div" {...props}>
			{children}
		</Text>
	);
};

const LyricFontSetting: FC = () => {
	const [fontFamily, setFontFamily] = useAtom(lyricFontFamilyAtom);
	const [fontWeight, setFontWeight] = useAtom(lyricFontWeightAtom);
	const [letterSpacing, setLetterSpacing] = useAtom(lyricLetterSpacingAtom);
	const [preview, setPreview] = useState("字体预览 Font Preview");
	const { t } = useTranslation();

	useLayoutEffect(() => {
		setPreview(
			t(
				"page.settings.lyricFont.fontPreview.defaultText",
				"字体预览 Font Preview",
			),
		);
	}, [t]);

	return (
		<Card mt="2">
			<Flex direction="row" align="center" gap="4">
				<Flex direction="column" flexGrow="1">
					<Text as="div">
						<Trans i18nKey="page.settings.lyricFont.subtitle">
							歌词字体设置
						</Trans>
					</Text>
					<Text as="div" color="gray" size="2" className={styles.desc}>
						<Trans i18nKey="page.settings.lyricFont.tip">
							此设置仅设置歌词字体，不包含其他组件的字体
						</Trans>
					</Text>
				</Flex>
			</Flex>
			<Flex direction="row" align="center" gap="4" my="2" wrap="wrap">
				<Flex direction="column" flexGrow="1">
					<Text as="div">
						<Trans i18nKey="page.settings.lyricFont.fontFamily.label">
							字体家族
						</Trans>
					</Text>
					<Text as="div" color="gray" size="2" className={styles.desc}>
						<Trans i18nKey="page.settings.lyricFont.fontFamily.description">
							以逗号分隔的字体名称组合，等同于 CSS 的 font-family
							属性，留空为默认
						</Trans>
					</Text>
				</Flex>
				<TextField.Root
					value={fontFamily}
					onChange={(e) => setFontFamily(e.currentTarget.value)}
				/>
			</Flex>
			<Flex direction="row" align="center" gap="4" my="2" wrap="wrap">
				<Flex direction="column" flexGrow="1">
					<Text as="div">
						<Trans i18nKey="page.settings.lyricFont.fontWeight.label">
							字体字重
						</Trans>
					</Text>
					<Text as="div" color="gray" size="2" className={styles.desc}>
						<Trans i18nKey="page.settings.lyricFont.fontWeight.description">
							等同于 CSS 的 font-weight 属性，设置 0 为默认
						</Trans>
					</Text>
				</Flex>
				<TextField.Root
					value={fontWeight}
					type="number"
					min={0}
					max={1000}
					onChange={(e) => setFontWeight(e.currentTarget.valueAsNumber)}
				/>
				<Slider
					value={[Number(fontWeight)]}
					min={0}
					max={1000}
					style={{ maxWidth: "10em" }}
					onValueChange={([value]) => setFontWeight(value)}
				/>
			</Flex>
			<Flex direction="row" align="center" gap="4" my="2" wrap="wrap">
				<Flex direction="column" flexGrow="1">
					<Text as="div">
						<Trans i18nKey="page.settings.lyricFont.letterSpacing.label">
							字符间距
						</Trans>
					</Text>
					<Text as="div" color="gray" size="2" className={styles.desc}>
						<Trans i18nKey="page.settings.lyricFont.letterSpacing.description">
							等同于 CSS 的 letter-spacing 属性，留空为默认
						</Trans>
					</Text>
				</Flex>
				<TextField.Root
					value={letterSpacing}
					onChange={(e) => setLetterSpacing(e.currentTarget.value)}
				/>
			</Flex>
			<Flex direction="row" align="center" gap="4" my="2" wrap="wrap">
				<Flex direction="column" flexGrow="1">
					<Text as="div">
						<Trans i18nKey="page.settings.lyricFont.fontPreview.label">
							字体预览
						</Trans>
					</Text>
				</Flex>
				<TextField.Root
					value={preview}
					onChange={(e) => setPreview(e.currentTarget.value)}
				/>
			</Flex>
			<Box
				style={{
					fontFamily: fontFamily || undefined,
					fontWeight: fontWeight || undefined,
					letterSpacing: letterSpacing || undefined,
					fontSize: "max(max(4.7vh, 3.2vw), 12px)",
					textAlign: "center",
				}}
			>
				{preview}
				<Box style={{ fontSize: "max(0.5em, 10px)", opacity: "0.3" }}>
					{preview}
				</Box>
			</Box>
		</Card>
	);
};

const appVersionAtom = loadable(atom(() => getVersion()));

function SliderSettings<T extends number | number[]>({
	label,
	description,
	configAtom,
	children,
	...rest
}: PropsWithChildren<{ configAtom: WritableAtom<T, [T], void> }> &
	React.ComponentProps<typeof SettingEntry> &
	Omit<SliderProps, "value" | "onValueChange">): ReactNode {
	const [value, setValue] = useAtom(configAtom);
	return (
		<SettingEntry label={label} description={description}>
			<Slider
				value={typeof value === "number" ? [value] : value}
				onValueChange={(v: number[]) =>
					typeof value === "number" ? setValue(v[0] as T) : setValue(v as T)
				}
				{...rest}
			/>
			{children}
		</SettingEntry>
	);
}

const GeneralSettings = () => {
	const { t, i18n } = useTranslation();
	const [mode, setMode] = useAtom(darkModeAtom);

	const supportedLanguagesMenu = useMemo(() => {
		function collectLocaleKey(
			root: Record<string, unknown>,
			result = new Set<string>(),
			currentKey = "",
		): Set<string> {
			for (const key in root) {
				const value = root[key];
				if (typeof value === "object" && value !== null) {
					collectLocaleKey(
						value as Record<string, unknown>,
						result,
						currentKey ? `${currentKey}.${key}` : key,
					);
				} else if (typeof value === "string" && value) {
					result.add(currentKey ? `${currentKey}.${key}` : key);
				}
			}
			return result;
		}

		const originalLocaleKeyNum = collectLocaleKey(
			i18n.options.resources?.["zh-CN"] ?? {},
		).size;
		const menu = Object.keys(i18n.options.resources ?? {})
			.map((langId) => {
				return {
					langId,
					keyNum: collectLocaleKey(i18n.options.resources?.[langId] ?? {}).size,
				};
			})
			.filter(({ keyNum }) => keyNum)
			.map(({ langId, keyNum }) => {
				const name =
					new Intl.DisplayNames(i18n.language, {
						type: "language",
					}).of(langId) || langId;
				const origName =
					new Intl.DisplayNames(langId, {
						type: "language",
					}).of(langId) || langId;
				return {
					label: `${origName === name ? origName : `${origName} (${name})`} (${(
						(keyNum / originalLocaleKeyNum) * 100
					).toFixed(1)}%)`,
					value: langId,
				};
			});
		menu.push({
			label: t("page.settings.general.displayLanguage.cimode", "本地化 ID"),
			value: "cimode",
		});
		return menu;
	}, [t, i18n.language, i18n.options.resources]);

	const themeMenu = useMemo(
		() => [
			{
				label: t("page.settings.general.theme.auto", "自动"),
				value: DarkMode.Auto,
			},
			{
				label: t("page.settings.general.theme.light", "浅色"),
				value: DarkMode.Light,
			},
			{
				label: t("page.settings.general.theme.dark", "深色"),
				value: DarkMode.Dark,
			},
		],
		[t],
	);

	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.settings.general.subtitle">常规</Trans>
			</SubTitle>
			<SettingEntry
				label={t("page.settings.general.displayLanguage.label", "显示语言")}
			>
				<Select.Root value={i18n.language} onValueChange={i18n.changeLanguage}>
					<Select.Trigger />
					<Select.Content>
						{supportedLanguagesMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>
			<SettingEntry
				label={t("page.settings.general.theme.label", "界面主题")}
				description={t(
					"page.settings.general.theme.description",
					"选择应用的外观主题",
				)}
			>
				<Select.Root value={mode} onValueChange={(v) => setMode(v as DarkMode)}>
					<Select.Trigger />
					<Select.Content>
						{themeMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>
		</>
	);
};

const LyricContentSettings = () => {
	const { t } = useTranslation();
	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.settings.lyricContent.subtitle">歌词内容</Trans>
			</SubTitle>
			<SwitchSettings
				label={t(
					"page.settings.lyricContent.enableLyricTranslationLine",
					"显示翻译歌词",
				)}
				configAtom={enableLyricTranslationLineAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.lyricContent.enableLyricRomanLine.label",
					"显示音译歌词",
				)}
				configAtom={enableLyricRomanLineAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.lyricContent.enableLyricSwapTransRomanLine.label",
					"启用音译歌词与翻译歌词互换",
				)}
				description={t(
					"page.settings.lyricContent.enableLyricSwapTransRomanLine.description",
					"仅上面两者启用后有效",
				)}
				configAtom={enableLyricSwapTransRomanLineAtom}
			/>
		</>
	);
};

const LyricAppearanceSettings = () => {
	const { t } = useTranslation();
	const [lyricPlayerImplValue, setLyricPlayerImplValue] = useAtom(
		lyricPlayerImplementationAtom,
	);
	const lyricPlayerImplementationMenu = useMemo(
		() => [
			{
				label: t(
					"page.settings.lyricAppearance.lyricPlayerImplementation.menu.dom",
					"DOM",
				),
				value: LyricPlayerImplementation.Dom,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricPlayerImplementation.menu.dom-slim",
					"DOM（阉割版）",
				),
				value: LyricPlayerImplementation.DomSlim,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricPlayerImplementation.menu.canvas",
					"Canvas",
				),
				value: LyricPlayerImplementation.Canvas,
			},
		],
		[t],
	);

	const getLyricPlayerString = (
		value: LyricPlayerImplementationObject,
	): string => {
		if (!value || !value.lyricPlayer) return LyricPlayerImplementation.Dom;
		if (value.lyricPlayer === DomLyricPlayer)
			return LyricPlayerImplementation.Dom;
		if (value.lyricPlayer === DomSlimLyricPlayer)
			return LyricPlayerImplementation.DomSlim;
		if (value.lyricPlayer === CanvasLyricPlayer)
			return LyricPlayerImplementation.Canvas;
		return LyricPlayerImplementation.Dom;
	};

	const handleLyricPlayerChange = (selectedString: string) => {
		let implementationObject: LyricPlayerImplementationObject;
		switch (selectedString) {
			case LyricPlayerImplementation.DomSlim:
				implementationObject = { lyricPlayer: DomSlimLyricPlayer };
				break;
			case LyricPlayerImplementation.Canvas:
				implementationObject = { lyricPlayer: CanvasLyricPlayer };
				break;
			default:
				implementationObject = { lyricPlayer: DomLyricPlayer };
				break;
		}
		setLyricPlayerImplValue(implementationObject);
		localStorage.setItem(
			"amll-react-full.lyricPlayerImplementation",
			selectedString,
		);
	};
	const [lyricSize, setLyricSize] = useAtom(lyricSizePresetAtom);

	const lyricSizeMenu = useMemo(
		() => [
			{
				label: t(
					"page.settings.lyricAppearance.lyricFontSize.menu.tiny",
					"超小",
				),
				value: LyricSizePreset.Tiny,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricFontSize.menu.extra_small",
					"极小",
				),
				value: LyricSizePreset.ExtraSmall,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricFontSize.menu.small",
					"小",
				),
				value: LyricSizePreset.Small,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricFontSize.menu.medium",
					"中",
				),
				value: LyricSizePreset.Medium,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricFontSize.menu.large",
					"大",
				),
				value: LyricSizePreset.Large,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricFontSize.menu.extra_large",
					"极大",
				),
				value: LyricSizePreset.ExtraLarge,
			},
			{
				label: t(
					"page.settings.lyricAppearance.lyricFontSize.menu.huge",
					"超大",
				),
				value: LyricSizePreset.Huge,
			},
		],
		[t],
	);

	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.settings.lyricAppearance.subtitle">歌词样式</Trans>
			</SubTitle>
			<SettingEntry
				label={t(
					"page.settings.lyricAppearance.lyricPlayerImplementation.label",
					"歌词播放器实现",
				)}
				description={t(
					"page.settings.lyricAppearance.lyricPlayerImplementation.description",
					"目前有两个歌词播放实现\n- DOM：使用 DOM 元素实现，目前效果最全，但性能开销大\n- Canvas：使用 Canvas 实现，仍在开发中，性能优异，但是部分细节效果不足",
				)}
			>
				<Select.Root
					value={getLyricPlayerString(lyricPlayerImplValue)}
					onValueChange={handleLyricPlayerChange}
				>
					<Select.Trigger />
					<Select.Content>
						{lyricPlayerImplementationMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>
			<LyricFontSetting />
			<SettingEntry
				label={t(
					"page.settings.lyricAppearance.lyricFontSize.label",
					"歌词字体大小",
				)}
				description={t(
					"page.settings.lyricAppearance.lyricFontSize.descriptionResponsive",
					"设置歌词的字体大小",
				)}
			>
				<Select.Root
					value={lyricSize}
					onValueChange={(value) => setLyricSize(value as LyricSizePresetValue)}
				>
					<Select.Trigger />
					<Select.Content>
						{lyricSizeMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>
			<SwitchSettings
				label={t(
					"page.settings.lyricAppearance.enableLyricLineBlurEffect.label",
					"启用歌词模糊效果",
				)}
				description={t(
					"page.settings.lyricAppearance.enableLyricLineBlurEffect.description",
					"对性能影响较高，如果遇到性能问题，可以尝试关闭此项。默认开启。",
				)}
				configAtom={enableLyricLineBlurEffectAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.lyricAppearance.enableLyricLineScaleEffect.label",
					"启用歌词缩放效果",
				)}
				description={t(
					"page.settings.lyricAppearance.enableLyricLineScaleEffect.description",
					"对性能无影响，非当前播放歌词行会略微缩小。默认开启",
				)}
				configAtom={enableLyricLineScaleEffectAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.lyricAppearance.enableLyricLineSpringAnimation.label",
					"启用歌词行弹簧动画效果",
				)}
				description={t(
					"page.settings.lyricAppearance.enableLyricLineSpringAnimation.description",
					"对性能影响较高，如果遇到性能问题，可以尝试关闭此项。默认开启。",
				)}
				configAtom={enableLyricLineSpringAnimationAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.lyricAppearance.advanceLyricDynamicLyricTime.label",
					"提前歌词行时序",
				)}
				description={t(
					"page.settings.lyricAppearance.advanceLyricDynamicLyricTime.description",
					"即将原歌词行的初始时间时序提前，以便在歌词滚动结束后刚好开始播放（逐词）歌词效果。这个行为更加接近 Apple Music 的效果，但是大部分情况下会导致歌词行末尾的歌词尚未播放完成便被切换到下一行。",
				)}
				configAtom={advanceLyricDynamicLyricTimeAtom}
			/>
			<NumberSettings
				placeholder="0.5"
				type="number"
				min="0"
				max="10.0"
				step="0.01"
				label={t(
					"page.settings.lyricAppearance.lyricWordFadeWidth.label",
					"逐词渐变宽度",
				)}
				description={t(
					"page.settings.lyricAppearance.lyricWordFadeWidth.description",
					"调节逐词歌词时单词的渐变过渡宽度，单位为一个全角字的宽度，默认为 0.5。\n如果要模拟 Apple Music for Android 的效果，可以设置为 1。\n如果要模拟 Apple Music for iPad 的效果，可以设置为 0.5。\n如需关闭逐词歌词时单词的渐变过渡效果，可以设置为 0。",
				)}
				configAtom={lyricWordFadeWidthAtom}
			/>
		</>
	);
};

const MusicInfoAppearanceSettings = () => {
	const { t } = useTranslation();
	const fftDataRange = useAtomValue(fftDataRangeAtom);
	const [playerControlsType, setPlayerControlsType] = useAtom(
		playerControlsTypeAtom,
	);
	const [verticalCoverLayout, setVerticalCoverLayout] = useAtom(
		verticalCoverLayoutAtom,
	);

	const playerControlsTypeMenu = useMemo(
		() => [
			{
				label: t(
					"page.settings.musicInfoAppearance.playerControlsType.menu.controls",
					"播放控制组件",
				),
				value: PlayerControlsType.Controls,
			},
			{
				label: t(
					"page.settings.musicInfoAppearance.playerControlsType.menu.fft",
					"线条音频可视化",
				),
				value: PlayerControlsType.FFT,
			},
			{
				label: t(
					"page.settings.musicInfoAppearance.playerControlsType.menu.none",
					"无",
				),
				value: PlayerControlsType.None,
			},
		],
		[t],
	);
	const verticalCoverLayoutMenu = useMemo(
		() => [
			{
				label: t(
					"page.settings.musicInfoAppearance.verticalCoverLayout.menu.auto",
					"自动",
				),
				value: VerticalCoverLayout.Auto,
			},
			{
				label: t(
					"page.settings.musicInfoAppearance.verticalCoverLayout.menu.forceNormal",
					"强制默认布局",
				),
				value: VerticalCoverLayout.ForceNormal,
			},
			{
				label: t(
					"page.settings.musicInfoAppearance.verticalCoverLayout.menu.forceImmersive",
					"强制沉浸布局",
				),
				value: VerticalCoverLayout.ForceImmersive,
			},
		],
		[t],
	);

	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.settings.musicInfoAppearance.subtitle">
					歌曲信息样式
				</Trans>
			</SubTitle>
			<SwitchSettings
				label={t(
					"page.settings.musicInfoAppearance.showMusicName.label",
					"显示歌曲名称",
				)}
				configAtom={showMusicNameAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.musicInfoAppearance.showMusicArtists.label",
					"显示歌曲作者",
				)}
				configAtom={showMusicArtistsAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.musicInfoAppearance.showMusicAlbum.label",
					"显示歌曲专辑名称",
				)}
				description={t(
					"page.settings.musicInfoAppearance.showMusicAlbum.description",
					"如果同时启用三个，布局上可能不太好看，请酌情调节。",
				)}
				configAtom={showMusicAlbumAtom}
			/>
			<Box height="1em" />
			<SwitchSettings
				label={t(
					"page.settings.musicInfoAppearance.showVolumeControl.label",
					"显示音量控制条",
				)}
				configAtom={showVolumeControlAtom}
			/>
			<SwitchSettings
				label={t(
					"page.settings.musicInfoAppearance.showBottomControl.label",
					"显示底部按钮组",
				)}
				description={t(
					"page.settings.musicInfoAppearance.showBottomControl.description",
					"在横向布局里是右下角的几个按钮，在竖向布局里是播放按钮下方的几个按钮",
				)}
				configAtom={showBottomControlAtom}
			/>
			<Box height="1em" />
			<SettingEntry
				label={t(
					"page.settings.musicInfoAppearance.playerControlsType.label",
					"播放控制组件类型",
				)}
				description={t(
					"page.settings.musicInfoAppearance.playerControlsType.description",
					"即歌曲信息下方的组件",
				)}
			>
				<Select.Root
					value={playerControlsType}
					onValueChange={(v) => setPlayerControlsType(v as PlayerControlsType)}
				>
					<Select.Trigger />
					<Select.Content>
						{playerControlsTypeMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>
			<Box height="1em" />
			<SettingEntry
				label={t(
					"page.settings.musicInfoAppearance.verticalCoverLayout.label",
					"垂直布局专辑图布局模式",
				)}
				description={t(
					"page.settings.musicInfoAppearance.verticalCoverLayout.description",
					"在隐藏歌词的情况下专辑图的布局方式：\n- 自动：根据专辑图是否为视频以使用沉浸布局\n- 强制默认布局：强制使用默认的专辑图布局\n- 强制沉浸布局：强制使用沉浸式的专辑图布局",
				)}
			>
				<Select.Root
					value={verticalCoverLayout}
					onValueChange={(v) =>
						setVerticalCoverLayout(v as VerticalCoverLayout)
					}
				>
					<Select.Trigger />
					<Select.Content>
						{verticalCoverLayoutMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>
			<SliderSettings
				label={t(
					"page.settings.musicInfoAppearance.fftDataRange.label",
					"音频可视化频域范围",
				)}
				description={t(
					"page.settings.musicInfoAppearance.fftDataRange.description",
					"单位为赫兹（hz），此项会影响音频可视化和背景跳动效果的展示效果",
				)}
				configAtom={fftDataRangeAtom}
				min={1}
				max={22050}
			>
				<Text wrap="nowrap">
					{fftDataRange[0]} Hz - {fftDataRange[1]} Hz
				</Text>
			</SliderSettings>
		</>
	);
};

const LyricBackgroundSettings = () => {
	const { t } = useTranslation();
	const [backgroundRendererValue, setBackgroundRendererValue] = useAtom(
		lyricBackgroundRendererAtom,
	);
	const [cssBackgroundProperty, setCssBackgroundProperty] = useAtom(
		cssBackgroundPropertyAtom,
	);
	const backgroundRendererMenu = useMemo(
		() => [
			{
				label: t(
					"page.settings.lyricBackground.menu.meshGradientRenderer",
					"网格渐变渲染器",
				),
				value: "mesh",
			},
			{
				label: t(
					"page.settings.lyricBackground.menu.pixiRenderer",
					"PixiJS 渲染器",
				),
				value: "pixi",
			},
			{
				label: t(
					"page.settings.lyricBackground.menu.cssBackground",
					"CSS 背景",
				),
				value: "css-bg",
			},
		],
		[t],
	);

	const getBackgroundRendererString = (
		value: LyricBackgroundRenderer,
	): string => {
		if (typeof value.renderer === "string" && value.renderer === "css-bg")
			return "css-bg";
		if (value.renderer === MeshGradientRenderer) return "mesh";
		if (value.renderer === PixiRenderer) return "pixi";
		return "mesh";
	};

	const handleBackgroundRendererChange = (selectedString: string) => {
		let rendererObject: LyricBackgroundRenderer;
		switch (selectedString) {
			case "mesh":
				rendererObject = { renderer: MeshGradientRenderer };
				break;
			case "pixi":
				rendererObject = { renderer: PixiRenderer };
				break;
			default:
				rendererObject = { renderer: "css-bg" };
				break;
		}
		setBackgroundRendererValue(rendererObject);
		localStorage.setItem(
			"amll-react-full.lyricBackgroundRenderer",
			selectedString,
		);
	};

	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.settings.lyricBackground.subtitle">歌词背景</Trans>
			</SubTitle>
			<SettingEntry
				label={t(
					"page.settings.lyricBackground.backgroundRenderer.label",
					"背景渲染器",
				)}
			>
				<Select.Root
					value={getBackgroundRendererString(backgroundRendererValue)}
					onValueChange={handleBackgroundRendererChange}
				>
					<Select.Trigger />
					<Select.Content>
						{backgroundRendererMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>

			{getBackgroundRendererString(backgroundRendererValue) === "css-bg" ? (
				<SettingEntry
					label={t(
						"page.settings.lyricBackground.lyricBackgroundColor.label",
						"CSS 背景属性值",
					)}
					description={t(
						"page.settings.lyricBackground.lyricBackgroundColor.description",
						"等同于放入 background 样式的字符串值，默认为 #111111",
					)}
				>
					<TextField.Root
						value={cssBackgroundProperty}
						onChange={(e) => setCssBackgroundProperty(e.currentTarget.value)}
					/>
				</SettingEntry>
			) : (
				<>
					<NumberSettings
						placeholder="60"
						type="number"
						min="1"
						max="1000"
						step="1"
						label={t(
							"page.settings.lyricBackground.lyricBackgroundFPS.label",
							"背景最高帧数",
						)}
						description={t(
							"page.settings.lyricBackground.lyricBackgroundFPS.description",
							"对性能影响较高，但是实际开销不大，如果遇到性能问题，可以尝试降低此值。默认值为 60。",
						)}
						configAtom={lyricBackgroundFPSAtom}
					/>
					<NumberSettings
						placeholder="1.0"
						type="number"
						min="0.01"
						max="10.0"
						step="0.01"
						label={t(
							"page.settings.lyricBackground.lyricBackgroundRenderScale.label",
							"背景渲染倍率",
						)}
						description={t(
							"page.settings.lyricBackground.lyricBackgroundRenderScale.description",
							"对性能影响较高，但是实际开销不大，如果遇到性能问题，可以尝试降低此值。默认值为 1 即每像素点渲染。",
						)}
						configAtom={lyricBackgroundRenderScaleAtom}
					/>
					<SwitchSettings
						label={t(
							"page.settings.lyricBackground.lyricBackgroundStaticMode.label",
							"背景静态模式",
						)}
						description={t(
							"page.settings.lyricBackground.lyricBackgroundStaticMode.description",
							"让背景会在除了切换歌曲变换封面的情况下保持静止，如果遇到了性能问题，可以考虑开启此项。\n注意：启用此项会导致背景跳动效果失效。",
						)}
						configAtom={lyricBackgroundStaticModeAtom}
					/>
				</>
			)}
		</>
	);
};

const OthersSettings = () => {
	const { t } = useTranslation();
	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.settings.others.subtitle">杂项</Trans>
			</SubTitle>
			<SwitchSettings
				label={t(
					"page.settings.others.showStatJSFrame.label",
					"显示性能统计信息",
				)}
				description={t(
					"page.settings.others.showStatJSFrame.description",
					"可以看到帧率、帧时间、内存占用（仅 Chromuim 系）等信息，对性能影响较小。",
				)}
				configAtom={showStatJSFrameAtom}
			/>
			<Button my="2" onClick={() => restartApp()}>
				<Trans i18nKey="page.settings.others.restartProgram">重启程序</Trans>
			</Button>
			<Button
				m="2"
				variant="soft"
				onClick={() => {
					router.navigate("/amll-dev");
				}}
			>
				<Trans i18nKey="page.settings.others.enterAmllDevPage">
					歌词页面开发用工具
				</Trans>
			</Button>
		</>
	);
};

const AboutSettings = () => {
	const { t } = useTranslation();
	const updateInfo = useAtomValue(updateInfoAtom);
	const appVersion = useAtomValue(appVersionAtom);
	const [updating, setUpdating] = useState(false);

	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.about.subtitle">关于</Trans>
			</SubTitle>
			<Text as="div">Apple Music-like Lyrics Player</Text>
			<Text as="div" style={{ opacity: "0.5" }}>
				{" "}
				{appVersion.state === "hasData" ? `${appVersion.data} - ` : ""}{" "}
				{commit.substring(0, 7)} - {branch}{" "}
			</Text>
			<Text as="div">
				<Trans i18nKey="page.about.credits">
					由 SteveXMH 及其所有 Github 协作者共同开发
				</Trans>
			</Text>
			<Suspense>
				{updateInfo && (
					<>
						<Separator size="4" my="3" />
						<div id="updater">
							{t(
								"page.about.newVersion",
								"有可用更新从 {currentVersion} 升级至 {nextVersion}",
								{
									currentVersion: updateInfo.currentVersion,
									nextVersion: updateInfo.version,
								},
							)}
						</div>
						<div
							style={{
								margin: "1em 0",
								whiteSpace: "pre-wrap",
							}}
						>
							{updateInfo.body}
						</div>
						<Button
							disabled={updating}
							loading={updating}
							onClick={() => {
								setUpdating(true);
								const toastId = toast.loading(
									t(
										"page.about.updating",
										"正在更新，完成后将会自动重启，请稍后……",
									),
								);
								let contentLength: number | undefined;
								let receivedLength = 0;
								function getProgressSizeText() {
									const rec = `${(receivedLength / 1024 / 1024).toFixed(2)} MiB`;
									if (contentLength === undefined) {
										return `(${rec})`;
									}
									const total = `${(contentLength / 1024 / 1024).toFixed(
										2,
									)} MiB`;
									return `(${rec} / ${total}) (${(
										(receivedLength / contentLength) * 100
									).toFixed(1)}%)`;
								}
								const getDownloadMessage = (progressText: string) =>
									t("page.about.downloading", "正在下载更新…… {progressText}", {
										progressText,
									});
								updateInfo.downloadAndInstall((evt) => {
									switch (evt.event) {
										case "Started": {
											contentLength = evt.data.contentLength;
											toast.update(toastId, {
												render: getDownloadMessage(getProgressSizeText()),
											});
											break;
										}
										case "Progress": {
											receivedLength += evt.data.chunkLength;
											toast.update(toastId, {
												render: getDownloadMessage(getProgressSizeText()),
												progress:
													contentLength === undefined
														? null
														: receivedLength / contentLength,
											});
											break;
										}
										case "Finished":
											toast.update(toastId, {
												render: t(
													"page.about.installing",
													"正在安装更新，将会自动重启，请稍后……",
												),
												progress: null,
											});
											setTimeout(restartApp, 1000);
											break;
									}
								});
							}}
						>
							<Trans i18nKey="page.about.installUpdate">更新并安装</Trans>
						</Button>
						<Box mb="3" />
					</>
				)}
			</Suspense>
		</>
	);
};

const SmtcSettings = () => {
	const { t } = useTranslation();
	const sessions = useAtomValue(smtcSessionsAtom);
	const [selectedSession, setSelectedSession] = useAtom(
		smtcSelectedSessionIdAtom,
	);
	const [textConversion, setTextConversion] = useAtom(
		smtcTextConversionModeAtom,
	);

	const handleForceUpdateClick = () => {
		invoke("request_smtc_update").catch((err) => {
			console.error("手动调用 request_smtc_update 失败:", err);
		});
	};

	const sessionMenu = useMemo(
		() => [
			{ label: t("page.settings.smtc.session.auto"), value: "null" },
			...(sessions || []).map((s: SmtcSession) => ({
				label: s.displayName,
				value: s.sessionId,
			})),
		],
		[t, sessions],
	);

	const textConversionMenu = useMemo(
		() => [
			{
				label: t("page.settings.smtc.textConversion.off"),
				value: TextConversionMode.Off,
			},
			{
				label: t("page.settings.smtc.textConversion.t2s"),
				value: TextConversionMode.TraditionalToSimplified,
			},
			{
				label: t("page.settings.smtc.textConversion.s2t"),
				value: TextConversionMode.SimplifiedToTraditional,
			},
			{
				label: t("page.settings.smtc.textConversion.s2tw"),
				value: TextConversionMode.SimplifiedToTaiwan,
			},
			{
				label: t("page.settings.smtc.textConversion.tw2s"),
				value: TextConversionMode.TaiwanToSimplified,
			},
			{
				label: t("page.settings.smtc.textConversion.s2hk"),
				value: TextConversionMode.SimplifiedToHongKong,
			},
			{
				label: t("page.settings.smtc.textConversion.hk2s"),
				value: TextConversionMode.HongKongToSimplified,
			},
		],
		[t],
	);

	const handleSessionChange = (value: string) => {
		const finalValue = value === "null" ? null : value;
		setSelectedSession(finalValue);

		if (finalValue) {
			localStorage.setItem("saved_smtc_session_id", finalValue);
		} else {
			localStorage.removeItem("saved_smtc_session_id");
		}

		invoke("control_external_media", {
			payload: { type: "selectSession", session_id: finalValue ?? "" },
		}).catch((err) => {
			console.error(err);
			toast.error(t("page.settings.smtc.session.changeFailed", { error: err }));
		});
	};

	const handleTextConversionChange = (value: TextConversionMode) => {
		setTextConversion(value);

		if (value && value !== TextConversionMode.Off) {
			localStorage.setItem("saved_smtc_text_conversion_mode", value);
		} else {
			localStorage.removeItem("saved_smtc_text_conversion_mode");
		}

		invoke("control_external_media", {
			payload: { type: "setTextConversion", mode: value },
		}).catch((err) => {
			console.error(err);
			toast.error(
				t("page.settings.smtc.textConversion.changeFailed", { error: err }),
			);
		});
	};

	return (
		<>
			<SubTitle>
				<Trans i18nKey="page.settings.smtc.subtitle">SMTC 监听设置</Trans>
			</SubTitle>

			<NumberSettings
				label={t("page.settings.smtc.timeOffset.label", "时间轴偏移量 (ms)")}
				description={t(
					"page.settings.smtc.timeOffset.description",
					"校准歌词与歌曲的同步。正数解决歌词偏早，负数解决歌词偏晚。",
				)}
				configAtom={smtcTimeOffsetAtom}
				type="number"
				step={50}
				placeholder="0"
			/>

			<SwitchSettings
				label={t(
					"page.settings.smtc.enableWsLyrics.label",
					"启用 WebSocket 歌词源",
				)}
				description={t(
					"page.settings.smtc.enableWsLyrics.description",
					"允许在 SMTC 模式下通过 WebSocket 接收歌词。",
				)}
				configAtom={enableWsLyricsInSmtcModeAtom}
			/>

			<SettingEntry
				label={t("page.settings.smtc.session.label")}
				description={t("page.settings.smtc.session.description")}
			>
				<Select.Root
					value={selectedSession ?? "null"}
					onValueChange={handleSessionChange}
				>
					<Select.Trigger />
					<Select.Content>
						{sessionMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>

			<SettingEntry
				label={t("page.settings.smtc.textConversion.label")}
				description={t("page.settings.smtc.textConversion.description")}
			>
				<Select.Root
					value={textConversion}
					onValueChange={(v) =>
						handleTextConversionChange(v as TextConversionMode)
					}
				>
					<Select.Trigger />
					<Select.Content>
						{textConversionMenu.map((item) => (
							<Select.Item key={item.value} value={item.value}>
								{item.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
			</SettingEntry>

			<Card mt="2">
				<Flex direction="row" align="center" gap="4">
					<Flex direction="column" flexGrow="1">
						<Text as="div">调试工具</Text>
						<Text as="div" color="gray" size="2">
							手动触发一次全面的状态刷新
						</Text>
					</Flex>
					<Button
						onClick={handleForceUpdateClick}
						variant="soft"
						color="orange"
					>
						强制刷新
					</Button>
				</Flex>
			</Card>
		</>
	);
};

export const PlayerSettingsTab: FC<{ category: string }> = ({ category }) => {
	switch (category) {
		case "general":
			return <GeneralSettings />;
		case "lyricContent":
			return <LyricContentSettings />;
		case "lyricAppearance":
			return <LyricAppearanceSettings />;
		case "musicInfoAppearance":
			return <MusicInfoAppearanceSettings />;
		case "lyricBackground":
			return <LyricBackgroundSettings />;
		case "others":
			return <OthersSettings />;
		case "about":
			return <AboutSettings />;
		case "smtc":
			return <SmtcSettings />;
		default:
			return null;
	}
};
