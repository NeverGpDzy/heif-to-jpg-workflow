# Versioning Policy

This project uses Semantic Versioning: `MAJOR.MINOR.PATCH`.

## Source of Truth

The current version is stored in [package.json](./package.json). Keep [package-lock.json](./package-lock.json) in sync.

## Version Rules

- `MAJOR`: incompatible CLI or workflow behavior changes.
- `MINOR`: backward-compatible features, new options, or new workflow capabilities.
- `PATCH`: bug fixes, documentation corrections, and small non-breaking maintenance changes.

## Release Workflow

1. Finish the code or documentation change.
2. Run `npm test`.
3. Choose the correct bump type.
4. Run `npm version patch --no-git-tag-version`, `npm version minor --no-git-tag-version`, or `npm version major --no-git-tag-version`.
5. Confirm `package.json` and `package-lock.json` changed together.
6. Commit the release change with a clear summary.
7. Create a Git tag only when publishing a release.

## Release Note Buckets

- `Added`: new features or supported workflows.
- `Changed`: behavior, defaults, documentation, or configuration changes.
- `Fixed`: bugs, regressions, and broken examples.
