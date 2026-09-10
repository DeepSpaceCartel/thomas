# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Release automation** (`.github/workflows/{version-bump,release-prepare,release-publish}.yaml`,
  `scripts/*.mjs`) — `package.json`'s version is now a live "PRs merged
  since last release" counter, bumped automatically on every same-repo
  PR; a manually-triggered `release-prepare` computes the next release
  version (a MINOR bump with PATCH reset), moves this `[Unreleased]`
  section into a dated one, and opens a PR for review; merging it tags
  the release and creates a GitHub Release with notes from that section.
  No npm publish. See `docs/project/releasing.md`.
- **Community health files** (`.github/`) — YAML-form issue templates
  (bug report, feature request), a pull request template checklist
  grounded in this repo's real discipline (CHANGELOG entry, a real
  cluster run for step-definition changes), `CODE_OF_CONDUCT.md`
  (Contributor Covenant v2.1), `CONTRIBUTING.md`, `SECURITY.md`
  (private reporting via GitHub Security Advisories), `CODEOWNERS`, and
  a weekly `dependabot.yml` (npm, pip, GitHub Actions).
- **Real-cluster CI** (`.github/workflows/{real-tests,cleanup-stale-releases}.yml`,
  `docs/project/ci.md`) — a second, gated CI tier that runs the actual
  `npm test` (real `helm`/`kubectl`/HTTP against a real cluster) on a
  self-hosted runner living inside it, alongside the existing
  GitHub-hosted `--dry-run` tier that still runs for anyone. Gated to
  `push: main` and same-repo `pull_request` only — never runs for a
  fork PR. `thomas-helm-test` is one fixed, shared namespace, so runs
  are fully serialized; an hourly job sweeps anything a crashed/timed-out
  run leaves behind. The runner pod authenticates via its own
  namespace-scoped, in-cluster `ServiceAccount` identity (no kubeconfig
  secret — `kubectl`/`helm` pick this up automatically). Both workflows
  are inert until the cluster-side runner/RBAC are provisioned (tracked
  separately, not in this repo).
- **CI/dev tool-version convergence** (`scripts/tools.sh`,
  `npm run install:tools`) — installs the real, current latest
  `helm`/`kubectl`, used identically by local dev and both real-cluster
  CI workflows (replacing `azure/setup-helm`/`azure/setup-kubectl`).
  This is the real fix for the root cause behind a whole class of CI
  failures: CI had silently drifted onto Helm v4 while this suite was
  built/verified against v3, since the two environments resolved
  "latest" through two different, independently-drifting mechanisms.
- **Full command-output logging** (`features/support/command_log.ts`) —
  every scenario's real `helm`/`kubectl` command output (full,
  untruncated STDOUT/STDERR, not just Cucumber's own truncated failure
  preview) is saved to its own file under `test-results/`, in every run
  (local dev included). `real-tests.yml` publishes the whole directory
  as a `scenario-logs` build artifact every run, pass or fail. This
  directly paid for itself once: it surfaced a real RBAC permission
  error that Cucumber's own truncated preview had hidden behind an
  unrelated `--atomic` deprecation warning.

### Changed

- **`README.md`** rewritten to lead with the same "why this matters"
  narrative as `docs/index.md` (Why this exists, the complete real
  `features/quickstart.feature`), replaced the dev-only `## Running`
  section with the real content of `docs/concepts/installing.md`
  (installing Thomas into another project), and added a prominent link
  to the published docs site. `mkdocs.yml`'s `site_url` corrected to the
  real custom domain (`alexander.ilyin.eu/Thomas`, was still the
  default `github.io` URL).
- **Repo moved to `DeepSpaceCartel/thomas`** (from `alexanderilyin/Thomas`)
  — every hardcoded repo/compare/release/advisories link updated
  accordingly across `CHANGELOG.md`, `README.md`, `mkdocs.yml`,
  `.github/{SECURITY,CODE_OF_CONDUCT}.md`, and
  `docs/{project/fixtures,concepts/installing}.md`. The custom Pages
  domain and the maintainer's own GitHub profile link are unaffected.

### Fixed

- **`release-publish.yaml` could auto-publish a release with no PR/review
  involved** — it originally inferred "a release-prepare PR just merged"
  purely from repo file state (`CHANGELOG.md`'s topmost dated section
  not yet tagged), so *any* push to `main` that happened to leave the
  repo in that state would trigger a publish. This happened for real:
  the first push of this automation to `main` auto-published `v0.1.0`,
  since `CHANGELOG.md`/`package.json` already described an untagged
  `0.1.0` from before the automation existed. Now gated on the PR event
  itself (`merged == true` + a `release/v*` head branch) — file state is
  still cross-checked as defense in depth, but no longer the trigger.
- **`docs.yaml` could fail with "Multiple artifacts named github-pages"
  on a re-run** — `upload-pages-artifact` re-uploads under the same
  fixed name on a new attempt without the previous attempt's artifact
  being cleaned up, so `deploy-pages` found two and refused to pick
  one. Now deletes any `github-pages` artifact from an earlier attempt
  of the same run before uploading a fresh one (gated on
  `github.run_attempt != '1'`, a no-op on a normal first-attempt run).
- **`scripts/tools.sh` had a real, reproducible SIGPIPE bug** — piping
  a live `curl`/`printf` process into `grep -m1` closes the pipe as
  soon as `grep` matches, killing the still-writing upstream process
  with a "curl: (23) Failure writing output to destination" error that
  `pipefail` then turned into a whole-script abort. Fixed by writing to
  a real file first and grepping that, never piping a live process into
  a command that might exit before consuming the whole stream.
- **Helm v3→v4 wording/flag changes** — confirmed against the real,
  newly-installed latest Helm rather than assumed: `--fail-on-repo-update-fail`
  is gone in v4 with no direct replacement (swapped the "Updating a Helm
  Repo" scenarios and `docs/reference/HELM.md` to `--timeout`, a real
  flag that still exists), and the real "duplicate install" error text
  changed from "cannot re-use a name" to "cannot reuse a name" (updated
  both `release-{full,short}.feature` assertions to match).
- **`helm dependency build` needs its repo pre-registered on a fresh
  machine** — `helm dependency update` resolves a `Chart.yaml`-declared
  repo as a one-off "unmanaged" lookup and never registers it, so the
  later `dependency build` (which trusts `Chart.lock` strictly) failed
  with "no repository definition" on any environment that had never run
  `helm repo add` for it before (i.e. every fresh CI runner). Added a
  real `helm repo add` step to both `dependency-{full,short}.feature`.
- **`features/quickstart.feature` excluded from the narrow-RBAC CI
  run** — it deliberately deploys into a `dev` namespace (the whole
  point: showing the pattern isn't tied to Thomas's own
  `thomas-helm-test` convention), which the CI `ServiceAccount`'s
  narrow RBAC scope has no access to. Tagged `@requires-broad-rbac` and
  excluded via `--tags` in CI rather than widening the RBAC for one
  demo scenario — still runs locally for anyone with broader cluster
  access; the tag is preserved in the byte-for-byte-identical embedded
  copies in `README.md`/`docs/index.md`.
- **`package-lock.json` drifting from `package.json`'s version** — the
  release-automation scripts (`bump-patch-version.mjs`,
  `compute-release-version.mjs`) only ever wrote `package.json`, never
  the lockfile, so two real automated patch bumps had already gone out
  of sync (`0.1.0` in the lockfile vs. `0.1.2` in `package.json`). Both
  scripts now run `npm install --package-lock-only` (via a new
  `scripts/lib/npm.mjs`) right after writing the new version.

## [0.1.0] - 2026-09-09

Initial release: a real (no-mocks) BDD test harness for Helm, `kubectl`,
and HTTP, built on `@cucumber/cucumber` + TypeScript.

### Added

- **Helm domain** — `Directory`/`Chart`/`Repository`/`Release` construction
  (five real chart sources: local directory, local archive, URL, OCI, and
  registered-repo reference), index/lint/package/dependency management,
  install/upgrade/rollback/status/history/test/get/list, and real
  `Chart.yaml` assertions.
- **Kubernetes domain** — real label-selector discovery for `Deployment`/
  `Service`/`Pod`/`ConfigMap`/`ReplicaSet`/`Secret`, `get`/events/logs,
  polling for eventually-consistent state (structured JSON and raw-text
  forms, including per-field structured Kubernetes Events), `exec`,
  RBAC checks (`kubectl auth can-i`), and TLS certificate inspection
  against a real cert-manager-issued `Secret`.
- **REST domain** — real HTTP/HTTPS requests (headers, query params, JSON
  bodies, multipart form/file upload, HTTP Basic auth) against a deployed
  app's real in-cluster Service DNS name, response assertions, dynamic
  value capture (response body/header) for use in later requests, and
  HTTPS certificate trust against a registered `Secret`.
- **Short/full syntax pair** for every scenario — a `-full.feature` using
  the base `DataTable` form throughout, and a `-short.feature` using
  oneline construction, progressive object discovery, and the Payload/
  HTTP-request accumulators wherever a real short form exists.
- **Fixture charts** (`charts/`) — `test-nginx` (minimal, off-the-shelf),
  `test-dependency` (real Helm dependency management), `test-rest-api`
  (a real FastAPI app: health probes, notes/users CRUD,
  Basic/API-key/Bearer/OAuth2/OIDC auth, file upload/download),
  `test-tls-demo` (self-signed cert-manager `Issuer`/`Certificate`).
- **`features/quickstart.feature`** — a single, complete, real
  Helm→Kubernetes→REST deploy-and-verify flow (the same one
  `docs/index.md`'s Quick Start documents verbatim); the one `.feature`
  file that doesn't follow the short/full pairing convention above,
  since it's a from-scratch narrative walkthrough rather than a
  scenario exercised twice at two syntax levels.
- **Documentation site** (`docs/`, MkDocs Material) — Concepts
  (installing, architecture, BDD conventions), a full
  Helm/Kubernetes/REST/Resources step reference (each with real
  `Short`/`Full` examples), and Project docs (fixtures and charts,
  getting started, development).
- **Agent skills** (`.agents/skills/`) — `thomas/` (this project's own
  step catalog and extension methodology), `mkdocs/` (this project's own
  docs-site authoring conventions), plus five general-purpose skills:
  `keepachangelog`, `semver`, `conventionalcommits`, `adr`, `docs`.
- CI (`.github/workflows/ci.yaml`): type-check, `cucumber-js --dry-run`,
  and `mkdocs build --strict` on every push/PR. GitHub Pages deploy
  (`.github/workflows/docs.yaml`) on push to `main`.

[Unreleased]: https://github.com/DeepSpaceCartel/thomas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/DeepSpaceCartel/thomas/releases/tag/v0.1.0
