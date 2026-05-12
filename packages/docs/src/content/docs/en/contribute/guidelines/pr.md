---
title: PR Process
---

## Basic Requirements

- All changes are merged into `main` via PR.
- After a PR is set to Ready for Review, the validation workflow `.github/workflows/pr-release-check.yaml` runs.
- Merge only after checks pass.

## What PR Validation Includes

The workflow runs two groups of checks:

1. `Release metadata`
   - Determines whether this PR requires a release plan.
   - Runs `pnpm run release:plan:check --base=... --head=...` when needed.

2. `Build libs`
   - Installs pnpm dependencies (`pnpm install --frozen-lockfile`).
   - Runs `pnpm run ci:build:libs`.

## When a Release Plan Is Required

The check logic is in `.github/scripts/check-release-requirements.mjs`:

- If all changes are in ignored scopes (docs/CI/infrastructure, etc.), the PR must have the `no-release` label.
- Otherwise, if there are non-ignored file changes, a release plan is required (stored in `.nx/version-plans/`).
- `no-release` can only be used for PRs where all changes are in ignored scopes.

## Create a Release Plan Locally

Run in the repository root:

```bash
# Generate plans only for touched projects (default behavior)
pnpm nx release plan
```

Then choose the bump level for each package and enter changelog messages as prompted.

The command generates plan files in `.nx/version-plans/`; commit them together with your changes.

## About Merging

A branch protection rule is enabled to allow only squash merges, keeping `main` clean.
