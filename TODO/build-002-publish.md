# build-002 — Publish to npm

**Milestone:** M3 Release (last task: the milestone hand-test follows) · **Depends on:** docs-001 ·
**Status:** needs user decisions (package name, GitHub repo, npm account)

## Decisions (recorded 2026-11-08, from `/fix-todo build-002`)

- **Blocked on docs-001.** Do docs-001 first. Then re-run `/fix-todo build-002`.
- **STEP reader:** keep `occt-import-js` for 0.1.0 and record the risk. Health check (2026-11-08): last release and
  last commit 2024-12-03, one maintainer (kovacsv), 296 stars, 26 open of 64 issues. `opencascade.js`: last npm
  release 1.1.1 (2023-03-23), 943 stars, one maintainer. `occt-wasm`: 72 stars, one maintainer, pushed recently,
  a different API. Re-check before the next release.
- **Publish auth:** npm trusted publishing (OIDC), no `NPM_TOKEN` secret.
- **Owner:** placeholders for the npm account and GitHub repo URL. Mark them TODO until the user fills them in.
  The name `step23mf` is free on npm (404 on 2026-11-08).

## Progress (2026-11-12, readiness pass)

- **Step 1, health check.** `occt-import-js` is unchanged since 2026-11-08: 0.0.23, last push 2024-12-03, 296 stars,
  28 open issues. It is still the pick for 0.1.0. Re-check it before 0.2.0.
- **Step 2, contents.** `npm pack --dry-run` lists exactly 10 files: `bin/`, `src/`, `LICENSE`, `README.md` and
  `package.json`. No WASM is bundled. The README "Third-party code" section names OpenCascade's LGPL-2.1 and links
  its source. `test/package.spec.js` asserts the file list and runs the installed tarball on `CUBE_MM`.
- **Step 3, name.** `@warpcad/step23mf` and `step23mf` both returned 404 on 2026-11-12. Whether the `@warpcad` npm org
  exists and belongs to the user is not known yet: `npm whoami` returned 401, so nobody is logged in on this machine.
- **Step 4, CHANGELOG.** Left to release-it, which writes `CHANGELOG.md` from conventional commits on the first release.
- **Step 5, workflows.** Changed by the user's decision (2026-11-12): no GitHub Actions run automatically, because
  Actions minutes cost money. The push gate is the local `.githooks/pre-push` (tests and typecheck on the pushed commit).
  `.github/workflows/ci.yml` (Node 20, 22 and 24 × Linux, macOS and Windows) is `workflow_dispatch` only, run by hand
  when a change touches WASM loading or paths. `.github/workflows/release.yml` is a manual `workflow_dispatch` that runs `npm run release` with trusted
  publishing. 0.1.0 is published locally, because the trusted publisher can only be set up once the package exists.
- **Acceptance.** All 7 scenarios PASS against the tarball installed into a scratch global prefix (see `ACCEPTANCE.md`).
- **Repository.** The user chose `github.com/WarpCad/step23mf`. `package.json` now has `repository`, `homepage` and
  `bugs` pointing there. npm uses `repository` to fix the README's relative links on the package page (`VERIFY.md`
  docs-001 row 2, still to check after publishing).
- **Still open, and the user's to do:** create the GitHub repo and add `origin`, make the first commit (check the
  commit email first), `npm login`, then `npm run release -- 0.1.0 --dry-run` followed by the real run.

## Goal

`npx step23mf part.step` works for anyone, from a published package with provenance.

## Spec

1. **Re-run the STEP reader health check** (CLAUDE.md, Library decisions). Fill in the rejection table in
   `docs/decisions/step-reader.md` for `occt-import-js` and `opencascade.js`, plus any pure-JS parser found:
   features, size, stars, open/closed issue ratio, last release, maintainers. If `occt-import-js` is now
   unmaintained, stop and ask.
2. **Package contents.** The `npm pack --dry-run` file list is exactly `bin/`, `src/`, `LICENSE`, `README.md` and
   `package.json`, with no `test/`, `TODO/` or `.claude/`. The `occt-import-js` WASM is **not** bundled: it stays a
   dependency, as the LGPL note in the decision record requires. Add a `THIRD-PARTY.md` (or a README section) that
   names OpenCascade's LGPL-2.1 and says where its source is.
3. **Name check.** `npm view step23mf` must 404, or belong to the user. If the name is taken, ask.
4. **CHANGELOG.md**: create it with `0.1.0` (or the version the user picks).
5. **Release workflow.** `.github/workflows/release.yml` runs on a version tag: `npm ci`, `npm test`,
   `npm run typecheck`, then `npm publish --provenance --access public` using an `NPM_TOKEN` secret, or trusted
   publishing if the user prefers. A separate `ci.yml` runs tests and typecheck on Node 20, 22 and 24 for every
   push and PR, on macOS, Linux and Windows. WASM loading and path handling differ by OS.
6. **Never push, tag or publish without an explicit request.** Prepare it, then ask.

## Testing

- `test/package.spec.js`: runs `npm pack --dry-run --json` and asserts the file list from step 2.
- Smoke test: `npm pack`, then install the tarball into a temp directory and run its `step23mf` on `CUBE_MM`.
  Exit 0 and one object `Cube`.

## Docs

`README.md` install section points at npm. `CHANGELOG.md`.

## Acceptance

All scenarios, 1–7, driven against the **installed tarball**, not the source tree. Milestone M3 ends here.
`/run-todos` pauses for the five-minute human hand-test.
