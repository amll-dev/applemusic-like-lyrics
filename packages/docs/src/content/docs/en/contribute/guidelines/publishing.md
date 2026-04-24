---
title: Publishing Packages
---

## Publishing Method

npm package publishing is triggered manually through GitHub Actions workflow:

- `.github/workflows/publish-libs.yaml`

The trigger is `workflow_dispatch` with a `mode` parameter:

- `dry-run`: rehearses versioning and publishing flow without actual publishing.
- `publish`: performs real release and pushes release commit/tag.

## Preconditions

- `publish` must be triggered from the `main` branch. `dry-run` can be triggered from other branches.
- A release plan file must exist in `.nx/version-plans/`.

## Workflow Steps Summary

1. When `mode=publish`, strictly validate current branch is `main`.
2. Install dependencies and release environment (Bun, Node 24, Rust, wasm-pack).
3. Validate trusted publishing runtime requirements (Node version, etc.).
4. Run `bun install --frozen-lockfile`.
5. Run `npx nx release --skip-publish --preid alpha` to create release commit and tags.
6. Format `package.json` and amend the release commit.
7. When `mode=publish`:
   - `git push origin HEAD:main --follow-tags`
   - Adjust pre-publish manifest handling (force npm registries, prepare npm manifests)
   - Run `npx nx release publish --excludeTaskDependencies` to publish to npm.

## Recommended Process

1. Trigger `mode=dry-run` first, and confirm version changes and pre-publish checks are correct (no tags pushed and no npm publish in this mode).
2. Trigger `mode=publish` to perform the formal release.
3. Verify npm packages and GitHub tags after publishing.
