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

[Unreleased]: https://github.com/alexanderilyin/Thomas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/alexanderilyin/Thomas/releases/tag/v0.1.0
