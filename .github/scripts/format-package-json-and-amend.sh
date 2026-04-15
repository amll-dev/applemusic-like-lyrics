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

old_head="$(git rev-parse HEAD)"
mapfile -t tags_to_move < <(git tag --points-at "$old_head")
echo "HEAD before amend: $old_head"
if [ "${#tags_to_move[@]}" -gt 0 ]; then
    echo "Tags currently pointing to old HEAD:"
    printf '  %s\n' "${tags_to_move[@]}"
else
    echo "No tags point at old HEAD."
fi

echo "Amending commit with formatted package.json files."
git add -- "${package_json_files[@]}"
git commit --amend --no-edit

new_head="$(git rev-parse HEAD)"
echo "HEAD after amend:  $new_head"

if [ "$new_head" != "$old_head" ] && [ "${#tags_to_move[@]}" -gt 0 ]; then
    echo "Repointing tags from old HEAD to amended HEAD."
    for tag in "${tags_to_move[@]}"; do
        # `nx release` creates annotated tags. Keep them annotated after amend so
        # `git push --follow-tags` can still publish them.
        git tag -f -a "$tag" "$new_head" -m "$tag"
        echo "  moved $tag -> $new_head (annotated)"
    done
else
    echo "No tag updates needed after amend."
fi

echo "Amended commit details:"
git show --pretty=fuller --stat --name-status --summary HEAD

echo "Amended."
git status --verbose
