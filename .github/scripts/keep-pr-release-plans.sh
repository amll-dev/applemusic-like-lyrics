#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <base-sha> <head-sha>"
  exit 2
fi

base_sha="$1"
head_sha="$2"

mapfile -t pr_plans < <(git diff --name-only "${base_sha}...${head_sha}" -- '.nx/version-plans/*.md')

if [ "${#pr_plans[@]}" -eq 0 ]; then
  echo "No release plan files were changed in this PR."
  exit 1
fi

echo "Release plans changed in this PR:"
printf ' - %s\n' "${pr_plans[@]}"

shopt -s nullglob
for plan in .nx/version-plans/*.md; do
  keep=false
  for pr_plan in "${pr_plans[@]}"; do
    if [ "$plan" = "$pr_plan" ]; then
      keep=true
      break
    fi
  done
  if [ "$keep" = false ]; then
    rm -f "$plan"
  fi
done

echo "Release plans left for validation:"
ls -1 .nx/version-plans/*.md
