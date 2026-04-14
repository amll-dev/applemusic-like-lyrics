#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob
plans=(.nx/version-plans/*.md)

if [ ${#plans[@]} -eq 0 ]; then
  echo "No release plans were found in .nx/version-plans."
  exit 1
fi

echo "Found ${#plans[@]} release plan(s)."
