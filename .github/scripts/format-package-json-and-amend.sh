#!/usr/bin/env bash
set -euo pipefail

echo "Formatting changes detected in package.json files."

mapfile -d '' package_json_files < <(git ls-files -z -- '**/package.json')
if [ "${#package_json_files[@]}" -eq 0 ]; then
    echo "No package.json files tracked by git."
    exit 0
fi

bun biome format --write "${package_json_files[@]}"

if git diff --quiet -- "${package_json_files[@]}"; then
    echo "No package.json formatting changes detected."
    exit 0
fi

echo "Staged changes to be amended:"
git status --verbose

echo "Amending commit with formatted package.json files."
git add -- "${package_json_files[@]}"
git commit --amend --no-edit

echo "Amended."
git status --verbose
