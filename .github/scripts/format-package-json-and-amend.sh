#!/usr/bin/env bash
set -euo pipefail

mapfile -d '' package_json_files < <(git ls-files -z -- '**/package.json')
if [ "${#package_json_files[@]}" -eq 0 ]; then
    echo "No package.json files tracked by git."
    exit 0
fi

npx biome format --write "${package_json_files[@]}"

if git diff --quiet -- "${package_json_files[@]}"; then
    echo "No package.json formatting changes detected."
    exit 0
fi

git add -- "${package_json_files[@]}"
git commit --amend --no-edit
