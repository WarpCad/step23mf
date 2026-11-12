# Decision: release tool

**Chosen:** `release-it` 21.1.2 with `@release-it/conventional-changelog` 12.0.2 (both MIT), run as `npm run release`.

It bumps the version, writes `CHANGELOG.md` from conventional commits, makes the release commit and `vX.Y.Z` tag,
pushes them, opens or prints the GitHub release, and publishes to npm. Tests and typecheck run first as hooks, so a
failing suite stops the release before any version changes.

**Why this one.** It is a local, step-by-step command with a dry-run mode. The maintainer sees each step and can
stop before anything leaves the machine. Its changelog plugin reads the conventional-commit style already used in
`CLAUDE.md`. It is the tool the maintainer asked for.

## Health check (2026-11-12)

Gathered from the npm registry and the GitHub API on the day this was recorded.

| Option | Version | License | Stars | Open / closed issues | Last push | Maintainers (npm) |
|---|---|---|---|---|---|---|
| `release-it` (chosen) | 21.1.2 | MIT | 9,083 | 2 / 824 | 2026-10-30 | 1 (webpro) |
| `semantic-release` | 25.0.9 | MIT | 24,166 | 339 / 1,201 | 2026-11-06 | 3 |
| `np` | 12.1.1 | MIT | 7,718 | 2 / 505 | 2026-10-24 | 3 |
| `@changesets/cli` | 3.0.3 | MIT | 12,572 | 200 / 624 | 2026-11-12 | 2 |
| `release-please` | 17.11.2 | Apache-2.0 | 7,766 | 307 / 687 | 2026-11-03 | 2 |
| `standard-version` | 9.5.0 | ISC | — | — | last npm publish 2023-04-01 | 6 |

Stars, issues and maintainers are from the registry and GitHub at the time of the check. Re-run this table before the
first release if it is more than a few months old.

**Single-maintainer risk.** `release-it` has one npm maintainer. The mitigation is that the release flow is a short
series of git and npm commands, so a fork or a hand-run replacement is cheap. Re-check the maintainer count and
last-push date before each major release.

## Rejection table

| Option | Reason it lost |
|---|---|
| `semantic-release` | Fully automatic: it derives the version from commit history on CI and publishes without a human step. The maintainer asked for a command they run and watch. Its issue backlog is large (339 open). |
| `np` | Good at the publish step, but it has no changelog generation and does not create a GitHub release. We would need a second tool for the changelog. |
| `@changesets/cli` | Built for monorepos. It needs a changeset file for every change, which is overhead for a single package. |
| `release-please` | Opens a release pull request from a GitHub Action. That is a CI-first model; the maintainer asked for a local command. |
| `standard-version` | Not published since 2023-04-01, so its security and Node-support status is unknown. |

## Settings that matter

- **Publish auth.** A local run publishes with the maintainer's `npm login`. Provenance (`npm publish --provenance`)
  only works from CI. The planned `release.yml` (`TODO/build-002-publish.md`, step 5) should run `npm run release` with
  npm trusted publishing (OIDC). Its provenance then comes from CI, not from the local config.
- **First release.** `package.json` already says `0.1.0`. `npm.allowSameVersion` is set so that
  `npm run release -- 0.1.0` does not stop at `npm version`. Later releases pass the new version or let the
  conventional-commit bump decide.
- **GitHub release.** Needs a `GITHUB_TOKEN` and an `origin` remote. Without the token release-it prints a
  web link to create the release by hand. The GitHub remote does not exist yet (`TODO/build-002-publish.md`).
- **Audit.** `release-it` 21.1.2 pulls `proxy-agent` → `get-uri` → `basic-ftp` 5.3.1, which carries GHSA-c475-qrg2-pj4r
  (a quadratic-time regex in the FTP directory-listing parser, fixed in 6.2.1). The package is pinned to 6.2.6 with an
  npm `overrides` entry. The chain is dev-only and does not ship to npm users. `npm audit` now reports 0 findings.
  Drop the override when release-it's own dependencies pick up the fixed version.
