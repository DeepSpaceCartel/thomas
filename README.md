# Thomas

A real (no mocks) BDD harness for Helm, `kubectl`, and HTTP, built with
`@cucumber/cucumber` + TypeScript. Every step shells out to a real
binary (`helm`, `kubectl`, `tar`) or makes a real `fetch()` call against
a real cluster — nothing here is stubbed.

## Purpose

This isn't just a Helm-chart test suite — it's a reusable pattern for
developing and functionally testing k8s-native applications: real
commands (never mocked), typed objects with real validation, and a
small, consistent table/assertion vocabulary, all in service of keeping
scenarios readable by a human who wasn't there when they were written.
Helm was the first domain this was built out against; the same
define-then-act, alias-reference, and table conventions now extend to
real `kubectl`-driven checks (`Deployment`/`Service`/`Pod`/`ConfigMap`/
`ReplicaSet`/`Secret` discovery and status, events, logs, polling, `exec`,
RBAC checks, TLS certificate inspection) and to real HTTP/HTTPS requests
against a deployed app's own endpoints. See [`docs/index.md`](docs/index.md)
for why this pattern specifically matters when an AI agent is doing the
work, and [`AGENTS.md`](AGENTS.md) for the canonical, tool-agnostic
reference an agent should read before working in this repo.

## Running

```bash
npm install
npm test              # full suite
npm run test:ff       # stop at the first failure
npm run test:verbose  # full step/table detail even for passing scenarios
npm run test:usage    # per-step-definition duration, slowest first
npm run test:junit    # per-scenario duration, written to report.xml
```

## Documentation

- **[`AGENTS.md`](AGENTS.md)** — canonical reference for any agent
  working in this repo: layout, conventions, known gotchas, current
  status. Start here.
- **[`docs/`](docs/index.md)** (built with MkDocs Material,
  `mkdocs build --strict`) — the human-facing reference site: BDD
  conventions, and the Helm/Kubernetes/REST/Resources step catalogs,
  each with real `Short`/`Full` examples.
- **[`.agents/skills/thomas/`](.agents/skills/thomas/SKILL.md)** — the
  same step catalogs, written for an agent to load before writing or
  extending a `.feature` file; `references/extending.md` is the
  from-scratch methodology for changing Thomas itself (alias resolution,
  the 6 table vocabularies, oneline/short-form siblings, the Payload/
  request accumulators, conditions, JMESPath).

Want to contribute? See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)
(dev setup, conventions, the CHANGELOG/versioning flow) and the
[Code of Conduct](.github/CODE_OF_CONDUCT.md).

This file stays intentionally short — every mechanism above has one
real, current, authoritative description in one of those three places;
duplicating it a fourth time here is exactly what let this file go
stale in earlier rounds.

## Layout

```
features/
  helm/            .feature files exercising real `helm` behavior
                    (Directory, Chart, Repo, Release, dependencies) —
                    each area has a -short.feature (oneline/payload-
                    accumulator forms) and -full.feature (DataTable
                    forms throughout) pair
  k8s/             .feature files exercising real `kubectl` behavior
                    (Deployment/Service/Pod/ConfigMap/ReplicaSet/Secret
                    discovery, polling, structured/raw events, TLS
                    certificate inspection)
  rest/            .feature files exercising a real deployed app's own
                    HTTP/HTTPS endpoints (health, notes CRUD, auth, files,
                    users)
  fixtures/        real files used by upload/download scenarios (e.g.
                    features/rest/files-{short,full}.feature)
  resources/       .feature files validating the resource object types
                    themselves (Directory/File/URL/OCIArtifact) - Helm
                    Repo/Helm Release validation lives in helm/ instead,
                    alongside their real actions
  step_definitions/          mirrors support/'s own domain split, one-for-one
    common.step.ts           type-agnostic Then steps and the Payload
                              accumulator, shared by every object type
    resources/
      directory.step.ts      Directory-scoped verbs: index, lint, package,
                              dependency management, purge
      file.step.ts           File: define (oneline + table + payload)
      url.step.ts             URL: define (oneline + table + payload)
      oci-artifact.step.ts   OCI Artifact: define (oneline + table + payload)
    helm/
      chart.step.ts          HelmChart-scoped: define/has:, template, show
      repo.step.ts           HelmRepo-scoped: add, remove, update, list
      release.step.ts        HelmRelease-scoped: install, upgrade, uninstall,
                              rollback, status, history, test, get, list
    k8s/
      kubernetes.step.ts     Deployment/Service/Pod/ConfigMap/ReplicaSet/
                              Secret-scoped: define (real discovery, plus
                              progressive discovery), get, get events, get
                              logs, delete, and (Pod only) poll, poll logs,
                              poll events, poll structured events, exec, RBAC
                              check
    http/
      http.step.ts           RestEndpoint-scoped: define, send a request
                              (table form + FIELD-row accumulator), and the
                              response status/headers assertions
  support/
    resources/     Directory, File, URL, OCIArtifact + the resource-resolution
                    machinery
    helm/          HelmChart, HelmRepo, HelmRelease, chart_ref_args, and real
                    chart-fetching logic
    k8s/           Deployment, Service, Pod, ConfigMap, ReplicaSet, Secret
                    (with its bounded cert-manager-race retry), and the
                    shared label-selector discovery logic
    http/          RestEndpoint, the real fetch()-based request/response
                    logic, and dynamic-value capture (capture.ts)
    (top level)    generic infra: assertions, command running, JMESPath
                    querying, polling (poll.ts), World
docs/              MkDocs Material site - see Documentation above
.agents/skills/    thomas/ and mkdocs/ (this project's own domain
                   skills) plus five general-purpose skills
                   (keepachangelog, semver, conventionalcommits, adr,
                   docs) - see AGENTS.md
charts/            fixture charts exercised by the suite - see
                   AGENTS.md's "Fixture charts" table
```

## The core pattern: define, then act

Every object is built by a pure `Given <Type> known as "<Alias>":` step
(or its oneline sibling, where one exists) — construction only, no side
effects. Anything that actually *does* something is a separate, explicit
`When` step referencing the alias:

```gherkin
Given Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "https://charts.bitnami.com/bitnami"
When I add Helm Repo known as "<BitnamiHelmRepo>"
Then the command exited with 0
```

See [BDD conventions](docs/concepts/bdd-conventions.md) for the full
pattern — resource substitution, the six table shapes and their oneline/
short-form siblings (including the Payload and HTTP-request
accumulators), JMESPath queries, conditions, progressive object
discovery, and dynamic value capture.

*[BDD]: Behavior-Driven Development
