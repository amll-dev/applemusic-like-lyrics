import {
	ArrowLeftIcon,
	Component1Icon,
	DesktopIcon,
	GearIcon,
	HamburgerMenuIcon,
	InfoCircledIcon,
	MagicWandIcon,
	MixerHorizontalIcon,
	QuestionMarkCircledIcon,
	TextAlignJustifyIcon,
} from "@radix-ui/react-icons";
import {
	Box,
	Button,
	Dialog,
	Flex,
	Heading,
	Separator,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { platform } from "@tauri-apps/plugin-os";
import type { Namespace } from "i18next";
import { atom, useAtom, useAtomValue } from "jotai";
import {
	type FC,
	type ReactNode,
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { loadedExtensionAtom } from "../../states/extensionsAtoms.ts";
import { ExtensionTab } from "./extension.tsx";
import styles from "./index.module.css";
import { PlayerSettingsTab } from "./player.tsx";

const currentPageAtom = atom("player.general");

const loadedExtensionsWithSettingsAtom = atom((get) => {
	const loadedExtensions = get(loadedExtensionAtom);
	return loadedExtensions.filter(
		(v) => v.context.registeredInjectPointComponent.settings,
	);
});

const usePlatform = () => {
	const [os, setOs] = useState<string | null>(null);

	useEffect(() => {
		setOs(platform());
	}, []);

	return os;
};

const SidebarButton: FC<{
	icon: ReactNode;
	label: string;
	isActive: boolean;
	onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => {
	return (
		<Button
			variant="soft"
			color={isActive ? "iris" : "gray"}
			onClick={onClick}
			style={{ justifyContent: "flex-start", cursor: "pointer" }}
			size="3"
			data-state={isActive ? "active" : "inactive"}
		>
			<Flex gap="3" align="center" style={{ minWidth: 0 }}>
				{icon}
				<Text truncate>{label}</Text>
			</Flex>
		</Button>
	);
};

const SidebarContent: FC<{ onNavigate: (pageId: string) => void }> = ({
	onNavigate,
}) => {
	const os = usePlatform();
	const [currentPage] = useAtom(currentPageAtom);
	const loadedExtensions = useAtomValue(loadedExtensionsWithSettingsAtom);
	const { t, i18n } = useTranslation();

	const playerSettingsPages = useMemo(() => {
		const pages = [
			{
				id: "general",
				label: t("page.settings.general.subtitle"),
				icon: <GearIcon width={20} height={20} />,
			},
			{
				id: "lyricContent",
				label: t("page.settings.lyricContent.subtitle"),
				icon: <TextAlignJustifyIcon width={20} height={20} />,
			},
			{
				id: "lyricAppearance",
				label: t("page.settings.lyricAppearance.subtitle"),
				icon: <MagicWandIcon width={20} height={20} />,
			},
			{
				id: "musicInfoAppearance",
				label: t("page.settings.musicInfoAppearance.subtitle"),
				icon: <InfoCircledIcon width={20} height={20} />,
			},
			{
				id: "lyricBackground",
				label: t("page.settings.lyricBackground.subtitle"),
				icon: <MixerHorizontalIcon width={20} height={20} />,
			},
			{
				id: "others",
				label: t("page.settings.others.subtitle"),
				icon: <Component1Icon width={20} height={20} />,
			},
		];

		if (os === "windows") {
			pages.push({
				id: "smtc",
				label: t("page.settings.smtc.subtitle", "SMTC 监听设置"),
				icon: <DesktopIcon width={20} height={20} />,
			});
		}

		pages.push({
			id: "about",
			label: t("page.about.subtitle"),
			icon: <QuestionMarkCircledIcon width={20} height={20} />,
		});

		return pages;
	}, [os, t]);

	return (
		<Flex direction="column" gap="1" width="100%">
			{playerSettingsPages.map((page) => (
				<SidebarButton
					key={`player.${page.id}`}
					icon={page.icon}
					label={page.label}
					isActive={currentPage === `player.${page.id}`}
					onClick={() => onNavigate(`player.${page.id}`)}
				/>
			))}
			<Separator my="2" size="4" />
			<SidebarButton
				key="extension.management"
				icon={<Component1Icon width={20} height={20} />}
				label={t("settings.extension.tab", "扩展程序管理")}
				isActive={currentPage === "extension.management"}
				onClick={() => onNavigate("extension.management")}
			/>
			{loadedExtensions.map((extension) => {
				const id = extension.extensionMeta.id;
				const extensionName = i18n.getFixedT(null, id as Namespace)("name", id);
				return (
					<SidebarButton
						key={`extension.${id}`}
						icon={
							<img
								src={String(extension.context.extensionMeta.icon)}
								width="20"
								height="20"
								alt={extensionName}
							/>
						}
						label={extensionName}
						isActive={currentPage === `extension.${id}`}
						onClick={() => onNavigate(`extension.${id}`)}
					/>
				);
			})}
		</Flex>
	);
};

export const Component: FC = () => {
	const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
	const loadedExtensions = useAtomValue(loadedExtensionsWithSettingsAtom);
	const { t } = useTranslation();

	const buttonContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const titlebar = document.getElementById("system-titlebar");
		const btnContainer = buttonContainerRef.current;

		if (titlebar && btnContainer) {
			const observer = new ResizeObserver(() => {
				const width = btnContainer.getBoundingClientRect().width;

				titlebar.style.left = `${width}px`;

				titlebar.style.width = `calc(100% - ${width}px)`;
			});

			observer.observe(btnContainer);

			return () => {
				observer.disconnect();
				if (titlebar) {
					titlebar.style.left = "0";
					titlebar.style.width = "100%";
				}
			};
		}
	}, []);

	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth > 600) {
				setMenuOpen(false);
			}
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	const [isMenuOpen, setMenuOpen] = useState(false);

	const handleNavigate = (pageId: string) => {
		setCurrentPage(pageId);
		setMenuOpen(false);
	};

	const renderContent = () => {
		if (currentPage.startsWith("player.")) {
			const category = currentPage.split(".")[1];
			return <PlayerSettingsTab category={category} />;
		}

		if (currentPage === "extension.management") {
			return (
				<Suspense>
					<ExtensionTab />
				</Suspense>
			);
		}

		if (currentPage.startsWith("extension.")) {
			const extensionId = currentPage.substring(10);
			const extension = loadedExtensions.find(
				(ext) => ext.extensionMeta.id === extensionId,
			);
			const ExtensionSettingsComponent =
				extension?.context.registeredInjectPointComponent.settings;

			if (ExtensionSettingsComponent) {
				return <ExtensionSettingsComponent />;
			}
		}

		return null;
	};

	return (
		<div
			style={{
				position: "fixed",
				top: "var(--space-8)",
				left: 0,
				right: 0,
				bottom: "80px",
				zIndex: 1000,
			}}
		>
			<style>{`
				.rt-Button[data-state='inactive'] {
					background-color: transparent !important;
				}
				.rt-Button[data-state='inactive']:hover {
					background-color: var(--gray-a3) !important;
				}
				.rt-Button:active {
					transform: none;
				}
			`}</style>

			<Dialog.Root open={isMenuOpen} onOpenChange={setMenuOpen}>
				<Dialog.Content className={styles.dialogContent}>
					<Heading mb="4">{t("common.settings", "设置")}</Heading>
					<SidebarContent onNavigate={handleNavigate} />
				</Dialog.Content>
			</Dialog.Root>

			<Flex
				ref={buttonContainerRef}
				align="center"
				gap="3"
				style={{
					position: "fixed",
					top: "var(--space-4)",
					left: 0,
					height: "var(--system-titlebar-height)",
					paddingLeft: "var(--space-4)",
					paddingRight: "var(--space-4)",
					zIndex: 10,
				}}
			>
				<Tooltip content={t("common.page.back", "返回")}>
					<Button variant="soft" onClick={() => history.back()} size="3">
						<ArrowLeftIcon />
					</Button>
				</Tooltip>
				<Button
					variant="soft"
					onClick={() => setMenuOpen(true)}
					size="3"
					className={styles.hamburgerButton}
				>
					<HamburgerMenuIcon />
				</Button>
			</Flex>

			<Flex
				direction="row"
				gap="4"
				style={{
					height: "100%",
					padding: "var(--space-4)",
					minHeight: 0,
				}}
			>
				<Box className={styles.sidebarDesktop}>
					<SidebarContent onNavigate={handleNavigate} />
				</Box>
				<Box className={styles.contentArea}>
					<div style={{ height: "var(--space-4)" }} />
					{renderContent()}
				</Box>
			</Flex>
		</div>
	);
};

Component.displayName = "SettingsPage";

export default Component;
