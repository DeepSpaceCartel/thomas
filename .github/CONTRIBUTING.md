# Contributing to Thomas

Thanks for considering a contribution. This project follows the
[Contributor Covenant](CODE_OF_CONDUCT.md).

## Getting set up

```bash
npm install
npm test              # full suite — needs a real cluster, see below
npm run test:ff       # stop at the first failure
```

See [`docs/project/development.md`](../docs/project/development.md) for
the full list of dev commands, including the docs site
(`npm run docs:serve`/`docs:build`).

**A real cluster is required** to run `.feature` scenarios end to end —
this project has a strict no-mocks policy (see `AGENTS.md`). CI
(`.github/workflows/ci.yaml`) only runs `npx cucumber-js --dry-run`
(checks every step resolves, no ambiguity) plus a typecheck and docs
build, precisely because it has no cluster access — so a PR touching
step definitions needs to have actually been run against a real
cluster by you before it's opened, not just dry-run-clean.

## Before you write a `.feature` file or step definition

Read **[`AGENTS.md`](../AGENTS.md)** first — it's the canonical,
tool-agnostic reference for this repo's conventions (layout, the
short/full syntax pair, real-command discipline, known sharp edges).
Then, depending on what you're doing:

- **Using existing steps** to write a new `.feature` scenario — see
  `.agents/skills/thomas/references/using-steps.md` and the matching
  `helm.md`/`kubectl.md`/`rest.md` catalog.
- **Adding a new step, table shape, or alias type** — see
  `.agents/skills/thomas/references/extending.md` first. Don't invent a
  new table vocabulary or resolution mechanism without checking whether
  an existing one already fits.

Every new construction/action step that has a closed field set should
get both a table (`-full.feature`) and, where a real short form exists,
a oneline/`-short.feature` sibling — see `docs/concepts/bdd-conventions.md`.

## Commit messages and the CHANGELOG

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
  (see `.agents/skills/conventionalcommits`) — `feat:`, `fix:`, `docs:`,
  `chore:`, etc.
- Every PR with a user-facing change adds a real entry under
  `## [Unreleased]` in `CHANGELOG.md`, [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
  format (see `.agents/skills/keepachangelog`). Skip this only for
  changes with nothing to note (a typo fix, an internal refactor with
  no behavior change).
- Don't hand-edit `package.json`'s `version` — it's bumped automatically
  on your PR by a bot once it's opened. See
  [`docs/project/releasing.md`](../docs/project/releasing.md) for the
  full versioning/release model, including the one real limitation
  (forked PRs don't get the automatic bump; bump it by hand in that
  case).

## Opening a PR

Use the PR template's checklist — it's specific to this repo's real
discipline (CHANGELOG entry, real cluster run for step-definition
changes, doc/skill updates for new step shapes), not generic
boilerplate. CI runs typecheck + dry-run + docs build automatically;
nothing further to trigger yourself.

## Reporting bugs or requesting features

Use the issue templates — they ask for the real domain (Helm/Kubernetes/
REST/docs/release-automation) and, for bugs, the actual command or
`.feature` file involved.
