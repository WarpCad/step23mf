# TODO/VERIFY.md — Manual verification queue

Short queue for one-off manual checks that no acceptance scenario covers. Newest entry at the top. Fill in Status and
Notes as each check is done, and leave the entries in place afterwards as a record.

Status values: `Open`, `OK`, `Issue` (file it as its own TODO and put the id in Notes), `N/A` (say why in Notes).

## Queue

### docs-001 — Install and examples from the registry (2026-11-10 14:07 UTC)

The install line and the examples in `README.md` and `docs/usage.md` were checked from a packed tarball installed into a
scratch prefix, because the package is not on npm yet. Those checks cover the code and the layout. They do not cover
the registry itself, or the links on the npm page, which needs a repository URL. Check these after build-002 publishes.

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | On a machine without the repo, run `npm i -g @warpcad/step23mf`, then follow `docs/usage.md` from "Get the example files" to the end. Every printed line should match the page. | Open | |
| 2 | Open the npm page for `@warpcad/step23mf`. The package does not include `docs/`, so the relative links from the README to `docs/` may break there. Fix them with a repository URL, or include the docs in the package. | Open | |

### 3mf-002 — Consumer check for the probe files (2026-11-09 21:26 UTC)

The four probe files are in `out/` (gitignored, not committed). Cura and Quick Look could not be observed from the
session that ran this task, because screenshots were blocked (no Screen Recording permission) and Quick Look produced
no thumbnail. Each row below is a check for someone who can open the app and look.

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Open `out/probe-object-colors-1to30.3mf` in UltiMaker Cura (Ultimaker 2+ Extended profile; 1:30 scale, fits the plate). Record: are the 18 part names shown? Are the object colors shown? | OK | 2026-11-10, Cura (version not recorded) on Ultimaker 2 Extended+. Names: shown (object list has `L_BRACKET_ASSEMBLY_ASM (1)` through `(14)`). Object colors: not shown. Cura colors every object by the configured filament type (the striped grey, yellow and navy look is that filament coloring, not the file's colors). |
| 2 | Open `out/probe-triangle-colors.3mf` in Cura. Record: do the six faces show six colors? | OK | 2026-11-10, Cura (version not recorded). Six faces: not shown. The cube takes the configured filament color, the same as every other object. |
| 3 | Open `out/probe-components-1to30.3mf` in Cura. Record: does the group `L_BRACKET_ASSEMBLY_ASM` appear as one object, or as 14 loose parts? | OK | 2026-11-09, opened alone. Object list shows six top-level entries: `L_BRACKET_ASSEMBLY_ASM`, `L_BRACKET_ASSEMBLY_ASM#1`, `PLATE`, `ROD_ASM (1)`, `ROD_ASM (2)`, `ROD_ASM (3)`. Each bracket group is one object, not 14 loose parts. The group names survive in Cura, unlike WarpCad. |
| 4 | Select `out/probe-object-colors.3mf` in Finder and press Space (Quick Look). Record: is a preview shown? Is it colored? | Open | |
| 5 | Open each probe in PrusaSlicer, Bambu Studio and OrcaSlicer, once each, after installing them. Fill in the matrix rows in `docs/compatibility.md`. | Open | Not installed on this machine. |
