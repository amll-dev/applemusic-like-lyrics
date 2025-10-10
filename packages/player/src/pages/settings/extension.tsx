import { ExclamationTriangleIcon, TrashIcon } from "@radix-ui/react-icons";
import {
	Avatar,
	Box,
	Button,
	Callout,
	Card,
	Flex,
	IconButton,
	Switch,
	Text,
} from "@radix-ui/themes";
import { path } from "@tauri-apps/api";
import { BaseDirectory } from "@tauri-apps/api/path";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir, remove, rename } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import { atom, useAtomValue, useStore } from "jotai";
import type { FC } from "react";
import { Trans, useTranslation } from "react-i18next";
import { extensionDirAtom, extensionMetaAtom } from "../../states/extension.ts";
import { ExtensionLoadResult } from "../../states/extensionsAtoms.ts";
import { restartApp } from "../../utils/player.ts";

const requireRestartAtom = atom(false);

export const ExtensionTab: FC = () => {
	const store = useStore();
	const { t } = useTranslation("translation");
	const extensionMetas = useAtomValue(extensionMetaAtom);
	const requireRestart = useAtomValue(requireRestartAtom);

	return (
		<>
			<Callout.Root color="red" my="2" mt="7">
				<Callout.Icon>
					<ExclamationTriangleIcon />
				</Callout.Icon>
				<Callout.Text>
					<Trans i18nKey="settings.extension.safetyWarning">
						扩展程序将可以访问并操作你的所有数据，包括你的歌单、播放信息等数据，请务必确保扩展程序来源可靠安全，并只安装你信任的扩展程序！作者不承担使用任何扩展程序后产生的一切后果！
					</Trans>
				</Callout.Text>
			</Callout.Root>
			<Callout.Root color="orange" my="2">
				<Callout.Icon>
					<ExclamationTriangleIcon />
				</Callout.Icon>
				<Callout.Text>
					<Trans i18nKey="settings.extension.wipWarning">
						扩展程序接口功能仍在开发中，其扩展程序接口有可能随时变更，敬请留意！
					</Trans>
				</Callout.Text>
			</Callout.Root>

			<Flex gap="2" wrap="wrap">
				<Button
					onClick={async () => {
						const extensionDir = await store.get(extensionDirAtom);
						const filters = [
							{
								name: t("common.dialog.filter.js", "JavaScript 文件 (*.js)"),
								extensions: ["js"],
							},
							{
								name: t("common.dialog.filter.all", "全部文件 (*.*)"),
								extensions: [],
							},
						];
						if (platform() === "android") {
							filters.length = 0;
						}
						if (platform() === "ios") {
							filters.length = 0;
						}
						const extensionFiles = await dialogOpen({
							title: t(
								"settings.extension.install.title",
								"请选择需要载入的 JavaScript 扩展程序文件",
							),
							filters,
							multiple: true,
						});
						console.log("获取到的插件文件", extensionFiles);
						if (extensionFiles === null) return;
						if (extensionFiles.length === 0) return;

						await mkdir(extensionDir, {
							recursive: true,
							baseDir: BaseDirectory.AppData,
						});
						for (const extensionFile of extensionFiles) {
							const extensionName = await path.basename(extensionFile);
							await copyFile(
								extensionFile,
								await path.join(extensionDir, extensionName),
							);
						}
						store.set(extensionMetaAtom);
					}}
				>
					<Trans i18nKey="settings.extension.installPlugins">
						安装扩展程序
					</Trans>
				</Button>
				<Button
					variant="soft"
					onClick={async () => {
						const extensionDir = await store.get(extensionDirAtom);
						await mkdir(extensionDir, {
							recursive: true,
						});
						await revealItemInDir(extensionDir);
					}}
				>
					<Trans i18nKey="settings.extension.openPluginDirectory">
						打开扩展程序文件夹
					</Trans>
				</Button>
				<Button
					variant={requireRestart ? "solid" : "soft"}
					onClick={() => restartApp()}
				>
					<Trans i18nKey="page.settings.others.restartProgram">重启程序</Trans>
				</Button>
			</Flex>
			{extensionMetas.map((meta) => (
				<Card key={`${meta.fileName}-${meta.id}`} my="2">
					<Flex align="center" gap="4" wrap="wrap">
						<Avatar
							size="5"
							fallback={<div />}
							src={String(meta.icon)}
							style={{
								color: "white",
							}}
						/>
						{meta.loadResult === ExtensionLoadResult.Loadable && (
							<Flex flexGrow="1" direction="column" justify="center">
								<Text weight="bold">
									{t("name", meta.id, { ns: meta.id as any })}
								</Text>
								<Text size="2">{meta.id}</Text>
							</Flex>
						)}
						{meta.loadResult === ExtensionLoadResult.Disabled && (
							<Flex flexGrow="1" direction="column" justify="center">
								<Text weight="bold">
									{t("name", meta.id, { ns: meta.id as any })}
								</Text>
								<Text size="2">{meta.id}</Text>
							</Flex>
						)}
						{meta.loadResult === ExtensionLoadResult.InvaildExtensionFile && (
							<Flex flexGrow="1" direction="column" justify="center">
								<Box>
									<Text color="gray">{meta.fileName}</Text>
								</Box>
								<Text color="gray" size="2">
									<Trans i18nKey="extension.error.invaildPluginFile">
										无效扩展程序文件
									</Trans>
								</Text>
							</Flex>
						)}
						{meta.loadResult === ExtensionLoadResult.MissingDependency && (
							<Flex flexGrow="1" direction="column" justify="center">
								<Box>
									<Text color="gray">{meta.fileName}</Text>
								</Box>
								<Text color="gray" size="2">
									<Trans i18nKey="extension.error.missingDependency">
										缺失依赖项
									</Trans>
								</Text>
							</Flex>
						)}
						{meta.loadResult === ExtensionLoadResult.MissingMetadata && (
							<Flex flexGrow="1" direction="column" justify="center">
								<Box>
									<Text color="gray">{meta.fileName}</Text>
								</Box>
								<Text color="gray" size="2">
									<Trans i18nKey="extension.error.missingMetadata">
										缺失必需元数据
									</Trans>
								</Text>
							</Flex>
						)}
						{meta.loadResult === ExtensionLoadResult.ExtensionIdConflict && (
							<Flex flexGrow="1" direction="column" justify="center">
								<Box>
									<Text color="gray">{meta.id}</Text>
								</Box>
								<Text color="gray" size="2">
									<Trans i18nKey="extension.error.pluginIdConflict">
										扩展程序 ID 冲突
									</Trans>
								</Text>
							</Flex>
						)}
						<Flex flexGrow="1" direction="column" justify="center">
							<Text color="gray" align="right" size="2">
								{meta.version}
							</Text>
							<Text color="gray" align="right" size="2">
								{meta.fileName}
							</Text>
						</Flex>
						<Switch
							disabled={
								meta.loadResult !== ExtensionLoadResult.Loadable &&
								meta.loadResult !== ExtensionLoadResult.Disabled
							}
							checked={meta.loadResult === ExtensionLoadResult.Loadable}
							onCheckedChange={async () => {
								const extensionDir = await store.get(extensionDirAtom);
								const extensionPath = await path.join(
									extensionDir,
									meta.fileName,
								);
								if (extensionPath.endsWith(".disabled")) {
									await rename(
										extensionPath,
										extensionPath.substring(0, extensionPath.length - 9),
									);
								} else {
									await rename(extensionPath, `${extensionPath}.disabled`);
								}
								store.set(extensionMetaAtom);
								store.set(requireRestartAtom, true);
							}}
						/>
						<IconButton
							variant="soft"
							onClick={async () => {
								const extensionDir = await store.get(extensionDirAtom);
								const extensionPath = await path.join(
									extensionDir,
									meta.fileName,
								);
								await remove(extensionPath);
								store.set(extensionMetaAtom);
								store.set(requireRestartAtom, true);
							}}
						>
							<TrashIcon />
						</IconButton>
					</Flex>
				</Card>
			))}
		</>
	);
};
