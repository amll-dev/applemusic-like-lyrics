import DefaultChangelogRenderer, {
	type ChangelogChange,
} from "nx/release/changelog-renderer";

export default class CustomChangelogRenderer extends DefaultChangelogRenderer {
	protected renderChangesByType(): string[] {
		const markdownLines: string[] = [];
		const groups = this.groupChangesBySemverImpact();

		this.appendChangeGroup(markdownLines, "Major Changes", groups.major);
		this.appendChangeGroup(markdownLines, "Minor Changes", groups.minor);
		this.appendChangeGroup(markdownLines, "Patch Changes", groups.patch);

		return markdownLines;
	}

	protected renderDependencyBumps(): string[] {
		const markdownLines = ["", "### Updated Dependencies", ""];
		this.dependencyBumps?.forEach(({ dependencyName, newVersion }) => {
			markdownLines.push(
				`- Updated \`${dependencyName}\` to \`${newVersion}\``,
			);
		});
		return markdownLines;
	}

	protected async renderAuthors(): Promise<string[]> {
		const markdownLines = await super.renderAuthors();
		return markdownLines.map((line) => {
			if (line === "### ❤️ Thank You") return "### Contributors";
			if (!line.startsWith("- ")) return line;
			const authorPattern = /- (.+) @(.+)$/;
			return line.replace(
				authorPattern,
				(_, name: string, username: string) =>
					`- ${name} [@${username}](https://github.com/${username})`,
			);
		});
	}

	protected formatChange(change: ChangelogChange): string {
		const line = super.formatChange(change);
		return this.boldConventionalTagInLine(line);
	}

	async render(): Promise<string> {
		return super.render();
	}

	private groupChangesBySemverImpact(): {
		major: ChangelogChange[];
		minor: ChangelogChange[];
		patch: ChangelogChange[];
	} {
		const major: ChangelogChange[] = [];
		const minor: ChangelogChange[] = [];
		const patch: ChangelogChange[] = [];

		for (const change of this.relevantChanges) {
			if (change.isBreaking) {
				major.push(change);
				continue;
			}
			if (change.type === "feat") {
				minor.push(change);
				continue;
			}
			patch.push(change);
		}

		return { major, minor, patch };
	}

	private appendChangeGroup(
		lines: string[],
		title: string,
		group: ChangelogChange[],
	): void {
		if (group.length === 0) {
			return;
		}

		const sortedGroup = this.sortChangesByPrefix(group);
		lines.push("", `### ${title}`, "");
		for (const change of sortedGroup) {
			lines.push(this.formatChange(change));
		}
	}

	private boldConventionalTagInLine(line: string): string {
		const conventionalTagPattern =
			/^(-\s+(?:\*\*[^*]+:\*\*\s+)?)([a-z]+(?:\([^)]+\))?:)(\s+)/i;
		return line.replace(
			conventionalTagPattern,
			(_, prefix: string, tag: string, suffix: string) =>
				`${prefix}**${tag}**${suffix}`,
		);
	}

	private sortChangesByPrefix(changes: ChangelogChange[]): ChangelogChange[] {
		const prefixOrder = new Map<string, number>([
			["feat", 0],
			["fix", 1],
			["perf", 2],
			["refactor", 3],
			["docs", 4],
			["chore", 5],
			["ci", 6],
			["test", 7],
			["build", 8],
			["style", 9],
			["revert", 10],
		]);

		return [...changes].sort((a, b) => {
			const aPrefix = this.getConventionalPrefix(a.description ?? "");
			const bPrefix = this.getConventionalPrefix(b.description ?? "");
			const aRank = prefixOrder.get(aPrefix) ?? 99;
			const bRank = prefixOrder.get(bPrefix) ?? 99;
			if (aRank !== bRank) return aRank - bRank;
			return 0;
		});
	}

	private getConventionalPrefix(description: string): string {
		const match = description.match(/^([a-z]+)(?:\([^)]+\))?:\s+/i);
		return match?.[1].toLowerCase() ?? "";
	}
}
