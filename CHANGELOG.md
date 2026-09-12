# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Every `assertCondition` failure now points at the current scenario's
  full log** (`support/command_log.ts`'s new `getCurrentLogPath`,
  `support/assert_condition.ts`) — `formatAvailableFields`'s own 80-char
  truncation means a real command's STDOUT/STDERR is often cut off in
  the console failure output; a `Full log: <absolute path>` line now
  points straight at the same scenario's `test-results/*.log` file
  (already real and untruncated), which every one of `assertCondition`'s
  callers gets automatically - command exit-code checks, HTTP response
  assertions, k8s field checks, anything using the shared
  `SOURCE|CONDITION|VALUE` machinery.

### Fixed

- **`Directory`/`File`'s `create ... at <path>` actions, `the content of
  file at ... is known as ...`, and both k8s `ConfigMap`/`Secret`
  `... from file ... at <path>` actions never soft-substituted their own
  `path`/`filePath` argument** (`directory.step.ts`, `file.step.ts`,
  `common.step.ts`, `kubernetes.step.ts`) — every sibling single-string
  argument elsewhere (`imageRef`, `contextRaw`, `endpoint`, `host`)
  already did. Surfaced making `devcontainer-builder`'s BDD suite safe
  for cucumber-js's own `--parallel`: 8 of its 10 `.feature` files write
  generated fixtures (SSH keys, a self-signed CA/cert, `buildkitd.toml`
  trust config) to shared paths that needed a worker-scoped segment
  (e.g. `<WorkerId>`) to avoid two concurrent workers clobbering each
  other's files — impossible to express without this fix, since these
  path arguments are plain step text, not a DataTable cell (which already
  substitutes). Fixed by wrapping each with `softSubstituteCapturedValue`,
  same as every other domain. Dogfooded in `features/resources/
  directory-full.feature`, `file-full.feature`, and
  `features/k8s/kubernetes-full.feature`.
- **`command_log.ts`'s per-scenario log filenames collide across
  `--parallel` workers** — a monotonically incrementing in-memory counter
  restarts at 0 in every worker subprocess, so two workers running the
  same feature file produced and silently overwrote the exact same log
  path. Now folds the real `CUCUMBER_WORKER_ID` (set by cucumber-js
  itself under `--parallel`, `"0"` otherwise) into the filename.

- **Documented a real `not_equals` footgun** (`docs/concepts/bdd-conventions.md`)
  — `status.podIP | not_equals | ''` (or any blank-`VALUE` `not_equals`
  meant as "wait until this field is set") passes immediately against
  an `undefined` field, since `String(undefined)` is the literal text
  `"undefined"`. Confirmed live migrating `devcontainer-builder`'s
  `health.feature`: a poll written this way passed on its first tick,
  before the Pod actually had a real IP. Use `exists` instead.
- **`hooks.ts`'s `BeforeAll` test-nginx repackaging broke any external
  consumer** — it ran `helm package charts/test-nginx` as a bare
  relative path, resolved against whatever cwd the *consuming* project
  happened to use, not Thomas's own root. Now resolves from the file's
  own real location (`import.meta.url`) and no-ops entirely when
  `charts/test-nginx` doesn't exist (true for every consumer — `charts/`
  isn't in Thomas's own `package.json` `"files"` list; it's an internal
  fixture, not something a consumer needs). Confirmed live consuming
  Thomas from `devcontainer-builder` via `file:../../thomas`. See
  `docs/concepts/installing.md` for the related `--install-links`
  guidance this same real consumption surfaced.
- **`release-{full,short}.feature`'s duplicate-install assertion** —
  expected STDERR text `cannot reuse a name`, which no longer matches
  current Helm's real wording (`cannot re-use a name that is still in
  use`, hyphenated) — a latent Helm-version wording drift, not a bug in
  the step itself. Updated the assertion to match.
- **The TLS and SSH domains' own generation/scan steps never applied
  captured-value substitution** (`tls.step.ts`'s `I generate Self-Signed
  CA .../I generate TLS Certificate ...` OPTION|VALUE tables;
  `ssh_key_pair.step.ts`'s `I generate SSH Key Pair ...` table and every
  `I scan the SSH host key for {string} ...` variant's own `host`
  argument) — every other domain (Docker, Helm, k8s) already had this
  wired in; these two were simply missed. Confirmed live migrating
  `devcontainer-builder`'s `git_source_resolution.feature`: a `-addext
  subjectAltName=DNS:...<Namespace>...` value reached `openssl` with the
  literal, un-substituted text `<Namespace>` still in it, producing a SAN
  that could never match any real hostname — surfaced as a genuine `git
  clone` TLS failure ("certificate subject name ... does not match
  target host name"), not a step-definition error, since openssl itself
  doesn't reject an unusual SAN string outright. Fixed by wiring in
  `substituteTableCapturedValues`/`softSubstituteCapturedValue`, same as
  every other domain. Verified live, not just "doesn't crash": decoded
  the resulting real certificate's own SAN extension and confirmed it
  held the substituted value, not the literal placeholder text — a
  scan's real target likewise now genuinely reaches the substituted
  host (confirmed via a real `ssh-keyscan` of `<ScanHost>` actually
  returning `github.com`'s own real key). Dogfooded in
  `features/tls/tls-full.feature` and `features/ssh/ssh-key-pair-full.feature`.

### Added

- **`Given the value of environment variable {string} or {string} is
  known as {string}`** (`captureEnvironmentVariableWithDefault`,
  `support/http/capture.ts`/`common.step.ts`) — a simpler sibling of the
  existing two-level-fallback env capture, for the single-real-env-var
  case. Surfaced making `devcontainer-builder`'s suite safe for
  cucumber-js's own `--parallel`: capturing `CUCUMBER_WORKER_ID` (set
  only under `--parallel`, `"0"` otherwise) has exactly one real
  candidate variable, and the existing step's fixed 3-arg fallback chain
  forced repeating that variable's name as its own fallback. No comma
  before `or`, one fewer placeholder than the existing step, so the two
  are textually unambiguous.
- **`When I wait for {word} known as {string} every ... for up to ...`**
  (`kubernetes.step.ts`) — retries real k8s object discovery itself (not a
  field of an already-known object), for a fire-and-forget/`--wait`-less
  rollout whose Pod may not exist the instant `helm upgrade` returns.
- **`When I poll Endpoint known as ... until the {httpMethod} request
  succeeds`** (`http.step.ts`) — a real IP existing doesn't mean the
  process behind it is listening yet (confirmed live: `fetch failed`
  against a genuinely-not-ready app). `pollUntil` (`support/poll.ts`) now
  accepts an async `evaluate` (backward-compatible) to support this.
- **Captured-value composition and environment-variable capture**
  (`support/http/capture.ts`, `common.step.ts`) — `Given the value of
  environment variable {string}, or {string}, or {string} is known as
  {string}` (a real `${VAR1:-${VAR2:-DEFAULT}}`, never a shell) and
  `Given the value {string} is known as {string}` (compose a new
  captured value from a literal that may embed others). Construction
  tables and progressive-selector values (a `namespace` field on
  `HelmRelease`/any k8s kind) now get a non-throwing "soft" substitution
  pass, so a captured value can stand in for them without disturbing
  normal `resolveResource`-style alias cells. `File`'s `create` action
  content now runs through the strict substitution too, so a generated
  config file can embed a captured value (e.g. a dynamic namespace in a
  `buildkitd.toml` trust rule).
- **`Then the value known as {string} {condition} {string}`**
  (`support/http/capture.ts`'s `assertCapturedValue`, `common.step.ts`) —
  compares two captured values (or a captured value against a composed
  template) directly, kept deliberately separate from the response/command
  `SOURCE|CONDITION|VALUE` assertion tables (which compare against a
  literal on purpose). Surfaced migrating `devcontainer-builder`'s
  `image_resolution.feature`: most of its scenarios assert a resolved
  image tag built from a captured registry URL plus a real,
  content-derived git sha — a genuinely dynamic expected value the
  existing assertion tables have no way to express. Dogfooded in
  `features/rest/notes-full.feature`.
- **`When I create ConfigMap known as {string} named {string} in {string}
  from file {string} at {string}`** (`kubernetes.step.ts`) — a real
  `kubectl create configmap ... --from-file=<key>=<path>`, for content a
  chart needs mounted but has no values field for (e.g. seeding a CA cert
  via a generic `extraVolumes`/`extraVolumeMounts` escape hatch). Registers
  into the same alias map discovery uses, so the already-generic `I delete
  {word} known as {string}` step is the cleanup, not a second bespoke one —
  its own doc comment had already anticipated exactly this case
  (a manually-created object with no `ownerReference`). Surfaced migrating
  `devcontainer-builder`'s `git_source_resolution.feature`: several
  scenarios need `GIT_SSL_CAINFO` pointed at a real mounted CA cert file,
  which the chart's own `--set-file`/inline-values mechanisms can't
  produce (they set Helm values, not standalone cluster objects). Notably,
  the *other* half of that same file's original need — seeding an SSH
  private key via a k8s Secret — turned out to need no new capability at
  all: `helm upgrade --set-file gitCredentials.entries[0].privateKey=<path>`
  (Helm's own array-index `--set-file` support) round-trips multi-line PEM
  content correctly into the chart's already-existing
  self-managed Secret, confirmed directly by rendering and decoding it —
  avoiding the inline-YAML block-scalar indentation break a raw template
  substitution would have hit.
- **`Given the content of file at {string} is known as {string}`**
  (`support/http/capture.ts`'s `captureFileContent`, `common.step.ts`) —
  the third real capture source alongside a command result and an
  environment variable: a real file's content, trimmed. Surfaced
  migrating `devcontainer-builder`'s `git_source_resolution.feature`: a
  real SSH public key needs to become a Helm `--set-string` value, and a
  raw `--set-file` of the same path (which worked cleanly for
  `gitCredentials.entries[].privateKey`, JSON/base64-encoded into a
  Secret) instead reads the file's own trailing newline into the value
  verbatim here — confirmed live to break `helm template` with a real
  YAML parse error, since this chart interpolates the value directly
  into a pod template's own shell-script block scalar. Dogfooded in
  `features/ssh/ssh-key-pair-full.feature`.
- **`Given the STDOUT of the last command is known as {string}`**
  (`support/http/capture.ts`'s `captureCommandStdout`, `common.step.ts`)
  — the raw, un-parsed sibling of the command-result JMESPath capture,
  for a command whose real output is already exactly the one plain line
  needed (no structured JSON/YAML to query). Surfaced by the same
  `git_source_resolution.feature` migration: a real `ssh-keyscan`'s
  current host-key line is needed verbatim for a `pinnedHostKey` value,
  and is genuinely unpredictable ahead of time (the fixture's own
  `ssh-keygen -A` generates a fresh host key at container startup).
  Dogfooded in `features/ssh/ssh-key-pair-full.feature`.
- **`When I create Secret known as {string} named {string} in {string}
  from file {string} at {string}`** (`kubernetes.step.ts`) — the `Secret`
  sibling of the `ConfigMap` create action above, same real shape
  (`kubectl create secret generic ... --from-file=<key>=<path>`, cleaned
  up via the existing generic `I delete {word} known as {string}`).
  Surfaced migrating `devcontainer-builder`'s
  `service_startup_configuration.feature`: several scenarios need a
  standalone Secret holding deliberately malformed
  `git-credentials.json` content (not valid JSON, or a JSON object where
  an array is required) - content no chart values field can express,
  unlike `gitCredentials.entries[].privateKey` (real PEM content, which
  round-trips fine through the chart's own array-index `--set-file`
  mechanism into its self-managed Secret, per the entry above). Dogfooded
  in `features/k8s/kubernetes-full.feature`.
- **`When I label namespace {string} with:`/`with {flags}`**
  (`kubernetes.step.ts`) — stateless real `kubectl label namespace`, for
  unblocking a privileged/rootless-unconfined BuildKit pod in a
  namespace whose default PodSecurity level would otherwise refuse it.
- **`HTTP`/`HTTPS Endpoint` gained a `pod` target** (`support/http/rest_endpoint.ts`,
  `docs/reference/REST.md`) — the Service-bypassing alternative to
  `service`: a real, live `kubectl get pod -o jsonpath={.status.podIP}`
  lookup at construction, for reaching a Pod a Service's own readiness
  gate would otherwise never route to. Dogfooded in
  `features/rest/health-{short,full}.feature`'s existing "Flipping
  readiness" scenario.
- **SSH and TLS domains** (`support/ssh/`, `support/tls/`,
  `docs/reference/{SSH,TLS}.md`) — fixture-generation-only: `SSH Key Pair`
  (real `ssh-keygen`/`ssh-keyscan`) and `Self-Signed CA`/`TLS Certificate`
  (real `openssl` CA/certificate generation, the generation-side
  counterpart to the existing cert-manager TLS inspection capability).
  Both build on `Directory`'s new `createDirectory` action.
- **Docker Buildx domain** (`support/docker/`, `step_definitions/docker/`,
  `docs/reference/DOCKER.md`) — a new first-class `Docker Buildx Builder`
  alias type: create/remove a real remote-BuildKit builder, build and
  push a real image, with scoped `--registry-credentials` isolated via
  a new `env` option on `run_command.ts`'s `runCommand`. Dogfooded
  against a real, disposable BuildKit instance + registry
  (`charts/test-registry`) in `thomas-helm-test`.
- **`Directory`/`File` resource extensions** — `createDirectory`/
  `createFile` (`When I create Directory known as "<Alias>" at
  "<path>"` / `When I create File known as "<Alias>" at "<path>" with:`),
  a real `mkdir -p`/write pair symmetric with `Directory`'s existing
  `purgeDirectory`. See `docs/reference/RESOURCES.md`.
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
