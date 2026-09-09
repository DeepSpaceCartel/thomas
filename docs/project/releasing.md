# Releasing

Three GitHub Actions workflows automate versioning end to end — no
manual `npm version`, no hand-editing the CHANGELOG's links, no manual
`git tag`. This is a GitHub-only release process (a tag + a GitHub
Release); nothing is published to npm.

## The version counter

`package.json`'s `version` is a live "PRs merged since the last
release" counter, not a value anyone chooses per PR. Every same-repo
pull request against `main` gets its PATCH component bumped by 1 —
automatically, by `version-bump.yaml` pushing a commit onto the PR's
own branch, so the bump shows up in the normal reviewable diff rather
than as a separate, unreviewed main-branch commit.

```
0.1.0 (last release) -> PR #42 merges -> 0.1.1 -> PR #43 merges -> 0.1.2 -> ...
```

**Known limitation**: `GITHUB_TOKEN` can only push to branches in this
repository, not to a fork — a PR opened from a fork won't get the
automatic bump. Bump it by hand in that case (edit `package.json`'s
`version` directly in the PR).

## Cutting a release

1. Go to **Actions → release-prepare → Run workflow** (`workflow_dispatch`,
   no inputs needed).
2. The workflow computes the version this release ships as: a **MINOR**
   bump with **PATCH reset to 0**, relative to the current
   major.minor — e.g. if PRs accumulated `package.json` to `0.1.7`, the
   release ships as `0.2.0`. The accumulated patch count never ships
   literally; it's discarded once a release happens.
3. It moves `CHANGELOG.md`'s `[Unreleased]` section into a new, dated
   `## [0.2.0] - YYYY-MM-DD` section, inserts a fresh empty
   `[Unreleased]` above it, and rewrites the comparison links at the
   bottom.
4. It opens a PR (`release/v0.2.0` → `main`) containing exactly those
   two changes — `package.json`'s version and `CHANGELOG.md` — with the
   new section's body as the PR description.
5. **Review and merge that PR like any other.** Merging it is what
   actually publishes the release: `release-publish.yaml` (triggered by
   that specific PR — branch `release/v0.2.0` — actually merging) tags
   the merge commit `v0.2.0` and creates a GitHub Release with notes
   taken directly from that CHANGELOG section.

No further manual step — once the PR is merged, the tag and the GitHub
Release both already exist.

### If `release-prepare` fails immediately

`[Unreleased]` was empty — there's nothing real to release yet. This is
a hard guard, checked before any branch or PR is created: it makes an
accidental content-free release impossible. Add real entries under
`[Unreleased]` (via a normal PR) first.

### If you dispatch `release-prepare` twice

The second run detects the `release/vX.Y.Z` branch already exists and
exits cleanly without creating a duplicate branch or PR.

## After a release ships

Immediately after merge, `package.json` is set to *exactly* the version
that was just released (`0.2.0`) — there's no separate "next version"
placeholder. The very next merged PR continues the same counter
(`0.2.0 → 0.2.1`), exactly as it did before the release.

## The three workflows, for debugging a stuck release

| Workflow | Trigger | Permissions | Does |
|---|---|---|---|
| `version-bump.yaml` | `pull_request` (same-repo) | `contents: write` | Bumps PATCH on the PR branch |
| `release-prepare.yaml` | `workflow_dispatch` | `contents: write`, `pull-requests: write` | Computes the release version, rewrites the CHANGELOG, opens the release PR |
| `release-publish.yaml` | `pull_request` (`closed`), gated on `merged == true` and a `release/v*` head branch | `contents: write` | Tags + creates the GitHub Release |

`release-publish.yaml` only runs when a PR whose branch matches
`release/v*` is actually merged — it's gated on the PR event itself
(`github.event.pull_request.merged == true`), not inferred from repo
file state. That's a deliberate correction: an earlier version inferred
"a release just merged" purely from "the CHANGELOG's topmost dated
section isn't tagged yet," which meant *any* push to `main` that
happened to leave the repo in that state — not just a real
`release-prepare` PR merge — would auto-publish a release. That bit
once, for real: the very first push of this automation to `main`
auto-published `v0.1.0` with no PR/review involved, because
`CHANGELOG.md`/`package.json` already described an untagged `0.1.0`
from before the automation existed. The fix ties publishing to the PR
event itself; the CHANGELOG/`package.json` state is still cross-checked
against the branch name as defense in depth (fails loudly on
disagreement, never guesses).

## Recommended: require branches to be up to date before merging

One residual gap: if two PRs are open at once, the second one's bump
target was computed before the first merged — if it merges without an
intervening push (no `synchronize` event to re-trigger the bump), the
patch counter under-counts by one for that PR. Enabling **"Require
branches to be up to date before merging"** branch protection on `main`
forces a rebase/merge (and therefore a fresh bump) before the merge
button is even clickable. This is a repo-settings change, not something
any of the three workflows enable automatically.

## The scripts behind all of this (`scripts/`)

Plain Node ESM (`.mjs`), no build step, runnable locally against any
file with the same `--path` flags the workflows use:

- `bump-patch-version.mjs` — the PATCH bump, with the exact-match
  idempotency check that keeps `version-bump.yaml` safe to re-run.
- `compute-release-version.mjs` — the MINOR-bump-reset-PATCH release
  version.
- `update-changelog-release.mjs` — the `[Unreleased]` → dated-section
  move + link rewrite; this is where the empty-`[Unreleased]` guard
  lives.
- `changelog-notes.mjs <version>` — extracts one version's section body
  (the release PR's description, and `gh release create`'s notes).
- `detect-pending-release.mjs` — cross-checks `CHANGELOG.md`'s topmost
  dated section against `package.json`'s version; `release-publish.yaml`
  compares its output against the merged branch's own name and fails
  loudly if they disagree.
