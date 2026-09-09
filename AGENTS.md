# AGENTS.md — Thomas

Canonical reference for any agent (Claude Code, Codex, or otherwise)
working in `Thomas/`. Read this before touching anything here. Deep
dives per domain live in `.agents/skills/` — this file is the map, the
skills are the territory.

## What this is

A real (no-mocks) BDD test harness for Helm charts, kubectl-discovered
k8s resources, and a real deployed app's own HTTP endpoints, built with
`@cucumber/cucumber` + TypeScript. Every step shells out to a real
binary (`helm`, `kubectl`) or makes a real `fetch()` call — nothing here
is stubbed, and every non-obvious design decision in this codebase was
verified by actually running something, not assumed. See `README.md`'s
"Purpose" section for the full framing: this is a *reusable pattern* for
developing/testing k8s-native applications, not just a Helm-chart test
suite.

**Read `README.md` in full before making any change.** It is the
authoritative, up-to-date spec of every convention below — this file is
an orientation map onto it, not a replacement for it. If this file and
`README.md` ever disagree, `README.md` wins; fix this file to match.

## Running it

```bash
npm install
npm test              # full suite
npm run test:ff       # stop at first failure
npm run test:verbose  # full step/table detail even for passing scenarios
npm run test:usage    # per-step-definition duration, slowest first
```

Requires a real, reachable k8s cluster (`kubectl`/`helm` configured
against it) — there is no offline/mocked mode. Cluster-touching
scenarios deploy into a dedicated `thomas-helm-test` namespace.

## The core pattern: define, then act

Every object is built by a pure `Given <Type> known as "<Alias>":`
step — construction only. Anything that runs a real command is a
separate `When` step referencing the alias:

```gherkin
Given Helm Repo known as "<BitnamiHelmRepo>":
  | PROPERTY | VALUE                              |
  | name     | bitnami                            |
  | url      | https://charts.bitnami.com/bitnami |
When I add Helm Repo known as "<BitnamiHelmRepo>" with:
  | OPTION | VALUE |
Then the command exited with 0
```

Every alias type is a `Map<string, T>` field on `World`
(`features/support/world.ts`) keyed by the literal alias string
(including the `<...>` brackets — `world.charts.get('<NginxHelmChart>')`,
not a stripped `NginxHelmChart`).

**Named exceptions to "pure construction"** (all deliberate, all
documented in `README.md`, don't add another one without naming it the
same way):
- `HelmRelease.chart`, `RestEndpoint.service` — resolve to the real object
  (`HelmChart`, `Service`), not a string, because their real CLI/URL
  representation depends on structure a plain string would have already
  lost.
- `Deployment`/`Service`/`Pod`/`ConfigMap`/`ReplicaSet`/`Secret`'s `Given`
  performs a real, read-only `kubectl get` — justified as the same
  category as `Directory`'s real `fs.existsSync` check, not a new kind
  of exception. `Secret` is the one variant that retries briefly: it can
  be created by a controller (cert-manager) reacting to another
  resource, asynchronously and outside Helm's own `--atomic` wait, so a
  single immediate `kubectl get` can genuinely race it — see
  `features/support/k8s/secret.ts`.
- `RestEndpoint`'s `Given` stays pure (no live check) — there's no cheap
  read-only analog to "is this URL reachable," so the first real
  validation is the paired `When`.

For using existing steps in a `.feature` file, or the full alias/
DataTable methodology (all 6 table vocabularies plus their oneline/short
companions, JMESPath `KEY` queries, the capture/embedded-substitution
mechanism, generic `Then` reuse, and how to add a new alias type or
table shape), see **`.agents/skills/thomas/`** — read it before writing
any new `.feature` file, or before changing Thomas itself.

## Layout

```
features/
  helm/      real `helm` behavior (chart, repo, directory, release) — also holds
             helm-repo-validation.feature/helm-release-validation.feature
             (the object-resolving exceptions' negative-path tests)
  k8s/       real `kubectl` behavior (Deployment/Service/Pod/Secret discovery,
             polling, exec, RBAC, TLS certificate inspection)
  rest/      real HTTP behavior against the rest-api fixture app
  resources/ resource-construction validation (the negative-path "Given ... has
             no field X" tests for Directory/File/URL/OCIArtifact)
  fixtures/  real files used by upload/download scenarios (features/rest/files-{short,full}.feature)
  step_definitions/  mirrors support/'s domain split (resources/, helm/, k8s/, http/),
                     plus common.step.ts at the top level (type-agnostic)
  support/
    resources/  Directory, File, URL, OCIArtifact + resolve_resource.ts
    helm/       HelmChart, HelmRepo, HelmRelease, chart_ref_args, real chart-fetch logic
    k8s/        Deployment, Service, Pod, ConfigMap, ReplicaSet, Secret + discover.ts
                (shared label-selector logic)
    http/       RestEndpoint, http_request.ts (real fetch()), capture.ts (dynamic values)
    (top level)  generic infra: assert_condition.ts, query.ts (JMESPath), run_command.ts,
                 poll.ts, attempt.ts, hooks.ts, world.ts
charts/
  test-nginx/         minimal off-the-shelf-image fixture (Deployment/Service/test-hook Pod)
  test-dependency/    exists solely to exercise `helm dependency build/list/update`
  test-rest-api/      real FastAPI test fixture — see charts/test-rest-api/README.md
  test-tls-demo/      self-signed cert-manager Issuer+Certificate fixture — see
                      features/k8s/tls-{short,full}.feature and docs/reference/KUBECTL.md#tls-certificates
```

## Domain skills (read the relevant one before working in that area)

- **`.agents/skills/thomas/`** — `SKILL.md` is the index; `references/`
  holds `using-steps.md`/`helm.md`/`kubectl.md`/`rest.md` (the
  usage-facing step catalogs, read first before writing a `.feature`
  file) and `extending.md` (the core Alias/DataTable methodology, read
  instead when changing Thomas itself, not just using it).
- **`charts/test-rest-api/README.md`** — how and why that fixture app is
  built the way it is (no custom image, health probes, in-memory/on-disk
  storage). Read before adding an endpoint or changing a health probe.

Five more skills under `.agents/skills/` are general-purpose, not
Thomas-specific — read the relevant one when the task at hand matches,
regardless of which project you're in: `keepachangelog/` (writing a
`CHANGELOG.md`), `semver/` (version numbers), `conventionalcommits/`
(commit message format), `adr/` (recording an architectural decision),
`docs/` (the Divio tutorial/how-to/reference/explanation framework —
what this repo's own `docs/` layout follows).

## Real-command discipline (non-negotiable, don't relax these)

- No mocks, ever. If a check can't be made real, don't add it — flag it
  instead.
- Every scenario that mutates real state (repo add/remove, HelmRelease
  install/uninstall) is self-contained and idempotent — full preamble
  redeclared per scenario, uninstalled at the end, no cross-scenario or
  cross-file shared state.
- Idempotency is *proven*, not assumed: run the suite twice in a row and
  check `kubectl get all -n thomas-helm-test` / `helm list` both come
  back empty afterward, every time you touch cluster-affecting code.
- Cluster-touching work goes in `thomas-helm-test`, never a shared or
  default namespace.
- Ground every non-trivial value (a log substring, an event reason, a
  field path) in real captured output before writing it into a `.feature`
  file. Never guess a value because it seems plausible.

## Known sharp edges (hit once each already, don't rediscover them)

- **cucumber-js's default step timeout is 5000ms**, far shorter than
  legitimate real polls this suite uses (up to 2 minutes) —
  `support/hooks.ts` raises it globally via `setDefaultTimeout`. If a
  new long-running step times out mysteriously, this is why; don't
  lower it, and don't add per-step overrides instead of understanding
  this.
- **A step function's declared arity matters to cucumber-js** — a
  shared function with an optional trailing `DataTable` param gets a
  function injected instead of `undefined` when no table is attached.
  Always register two distinctly-shaped functions (see
  `common.step.ts`'s `assertExitCodeOnly`/`assertExitCodeAndOutput`) —
  never one function with an optional last parameter.
- **Loop-generated step text is invisible to static tooling** (VS
  Code's Cucumber extension scans source text for literal `Given`/
  `When`/`Then` calls) — a `for (const verb of [...]) { When(\`...${verb}...\`, ...) }`
  loop works fine at runtime but shows every generated step as
  "undefined" in the editor. Prefer one step with a `{word}` Cucumber
  Expression parameter + runtime validation over a loop of literal-text
  registrations.
- **A Helm label value that looks like a number must be `| quote`d.**
  `app.kubernetes.io/version: {{ .Chart.AppVersion }}` renders the bare
  value into YAML, which parses `1.27` as a float, not a string, and
  `helm upgrade` fails outright decoding it into a `map[string]string`.
  Always `{{ .Chart.AppVersion | quote }}`.
- **A Service can't route to a Pod it has just excluded.** Once a Pod
  is confirmed NotReady, a request routed through its Service has no
  backend to reach — it fails to connect, it does not return the app's
  real error status. Don't write a scenario that expects otherwise;
  assert the readiness state directly (`kubectl`/Pod polling), not via
  a request that structurally can't arrive.
- **`attempt()` (`support/attempt.ts`) is async-aware** — every
  `attempt(this, () => ...)` call site must `return` it (not just call
  it), or cucumber-js won't wait for it to settle.

## Status

- **Phase 1** (health-probe endpoints, `RestEndpoint`/HTTP mechanism,
  `charts/test-rest-api` skeleton) — shipped, verified.
- **Phase 2** (`/files/*`, `/notes/*` CRUD, dynamic-value capture,
  multipart upload, binary-safe response bodies) — shipped, verified
  (66/66 scenarios, twice in a row, cluster confirmed clean both times).
- **Phase 3** (`/users/*` + 5 real auth methods — ApiKey/Basic/Bearer/
  self-hosted OAuth2/OIDC) — implemented and covered by real scenarios in
  `features/rest/users-{short,full}.feature` and `features/rest/auth-{short,full}.feature`; rerun the
  full suite twice before calling it verified. Full plan at
  `docs/claude/plans/0001-phase3-users-and-auth.md`. Two small,
  independent, not-yet-closed test-coverage gaps are tracked at
  `docs/claude/plans/0002-test-coverage-gaps.md`.
- **Phase 4** ("Aliases" → "Resources" rename across code/docs, oneline
  construction steps for every fixed-field type, `HelmRelease`/
  `OCIArtifact`/`RestEndpoint` step-text spacing fixes, and three new
  real capabilities — `kubectl exec`, `kubectl auth can-i` (RBAC), and
  cert-manager TLS certificate inspection via a self-signed fixture
  chart) — shipped, verified (71/71 scenarios, cluster confirmed clean
  after a real run).
