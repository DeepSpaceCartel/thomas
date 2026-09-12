# Thomas

A real (no mocks) BDD harness for Helm, `kubectl`, and HTTP, built with
`@cucumber/cucumber` + TypeScript. Every step shells out to a real
binary (`helm`, `kubectl`, `tar`) or makes a real `fetch()` call against
a real cluster — nothing here is stubbed. The harness is designed
around readable scenarios and observable behavior: construct an object,
perform an explicit action, then assert on the real command or response.

## Why this exists

Reviewing and maintaining a codebase an AI agent wrote or extended has a
real, specific problem ordinary code review doesn't: a confident commit
message or PR description ("added X, verified it works") is just a
claim, and a human reviewer can't tell from the diff alone whether
"verified" meant "ran once locally" or "asserted against mocked
responses that happen to match what the code returns." Neither tells
you what happens against the real thing.

A `.feature` file sidesteps that problem structurally, not by asking
for more trust: every step shells out to a real `helm`/`kubectl`/HTTP
call against a real cluster, so a passing scenario isn't a claim to
take on faith — it's independently re-runnable, human-readable evidence
that a specific real behavior actually happened, at a specific point in
time, checkable by anyone (including the next agent) without
re-deriving it from the implementation. That's what makes this pattern
worth adopting specifically *because* an agent is doing the work: the
review question stops being "do I trust this changed?" and becomes
"does this scenario, which I can read in plain English and re-run
myself, actually prove what it claims to?"

This isn't just a Helm-chart test suite, either — it's a reusable
pattern for developing and functionally testing k8s-native applications
generally: real commands (never mocked), typed objects with real
validation, and a small, consistent table/assertion vocabulary. Helm
was the first domain this was built out against; the same
define-then-act, alias-reference, and table conventions now extend to
real `kubectl`-driven checks (`Deployment`/`Service`/`Pod`/`ConfigMap`/
`ReplicaSet`/`Secret` discovery and status, events, logs, polling, `exec`,
RBAC checks, TLS certificate inspection), to real HTTP/HTTPS requests
against a deployed app's own endpoints, to real `docker buildx` builds
and pushes against a real remote BuildKit endpoint, and to real
`ssh-keygen`/`ssh-keyscan`/`openssl` fixture generation (a real SSH
keypair, a real self-signed CA and certificate chain). See
[`AGENTS.md`](AGENTS.md) for
the canonical, tool-agnostic reference an agent should read before
working in this repo.

## Quick Start

The complete, real, passing `features/quickstart.feature` — nothing
trimmed or simplified — deploys a chart, verifies it in Kubernetes,
then checks it over REST:

```gherkin
Feature: Deploy and Test a Service
  As a full-stack developer
  I want to deploy a service and check that it is working
  So that I can see a complete service deployment and verification flow

  # Deploys into "dev", not thomas-helm-test - see docs/project/ci.md
  # for why that excludes this scenario from the narrowly-scoped real
  # CI run.
  @requires-broad-rbac
  Scenario: Deploy a chart from a folder, verify it in k8s, then check it over REST
    Given Helm Chart "<NginxHelmChart>" in "./charts/test-nginx"
    And Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "nginx-release" in "dev"
    When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
    Then the command succeeds
    When I get status of Helm Release "<NginxRelease>" as YAML
    Then Helm Release "<NginxRelease>" is "deployed"

    Given Deployment "<NginxDeployment>"
    And "<NginxDeployment>" namespace is "dev"
    And "<NginxDeployment>" label "app.kubernetes.io/instance" is "nginx-release"
    When I get Deployment "<NginxDeployment>" as JSON
    Then Deployment "<NginxDeployment>" has "status.readyReplicas" >= 1

    Given Service "<NginxService>"
    And "<NginxService>" namespace is "dev"
    And "<NginxService>" label "app.kubernetes.io/instance" is "nginx-release"
    When I get Service "<NginxService>" as JSON
    Then Service "<NginxService>" has "spec.type" == ClusterIP
    And HTTP Endpoint "<NginxApi>" on "<NginxService>" port "80"
    When I send a GET request to Endpoint known as "<NginxApi>" path "/"
    Then the response status is 200

    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains uninstalled
```

See the full walkthrough (with every step, and why each one is
there) at **[alexander.ilyin.eu/Thomas](https://alexander.ilyin.eu/Thomas/#quick-start)**.

## Installing Thomas in another project

Thomas's step implementations are plain TypeScript, loaded directly by
`tsx`'s ESM loader — there is no compiled `dist/` build to consume.
That means a consuming project can point its own `cucumber.mjs` at the
installed package's `.ts` sources the same way Thomas points at its
own.

### Install

This package is not published to a registry yet — install it as a git
dependency:

```bash
npm install github:DeepSpaceCartel/thomas
```

### Installing the agent skill

A separate, lighter-weight install: the [`thomas`](.agents/skills/thomas/SKILL.md)
agent skill (the step catalog and extending methodology, written for an
agent rather than for `tsx`/`cucumber`) can be pulled into another
project's own skill directories via the [`skills` CLI](https://www.skills.sh/):

```bash
npx skills add DeepSpaceCartel/thomas
```

This complements the npm install above rather than replacing it — it gets
an agent working in the consuming project the same guidance an agent gets
working in this one, but assumes that project follows the same layout
(`features/`, `charts/`, `docs/reference/*`) this skill's references point
at.

### Wire up your own `cucumber.mjs`

```js
import { register } from 'tsx/esm/api';
register();

export default {
  import: [
    'node_modules/thomas/features/support/**/*.ts',
    'node_modules/thomas/features/step_definitions/**/*.ts',
    'features/step_definitions/**/*.ts', // your own project-specific steps
  ],
  paths: ['features/**/*.feature'],
};
```

Your project needs `@cucumber/cucumber` and `tsx` installed directly
(Thomas declares both as `peerDependencies`, not bundled dependencies,
so your project's own versions are what actually run).

### Using only some of the steps

The `exports` map lets you cherry-pick a single domain instead of
importing everything — for example, a project that only needs the Helm
steps:

```js
export default {
  import: [
    'node_modules/thomas/features/support/helm/**/*.ts',
    'node_modules/thomas/features/support/resources/**/*.ts', // Directory/File/URL/OCI Artifact - see docs/reference/RESOURCES.md
    'node_modules/thomas/features/support/{assert_condition,query,run_command,attempt,world}.ts',
    'node_modules/thomas/features/step_definitions/{directory,helm,helm-repo,helm-release,common}.step.ts',
  ],
  paths: ['features/**/*.feature'],
};
```

### Pointing steps at your own resources

Every alias's `PROPERTY` rows are just data — point `Directory`/`File`
paths, `HelmRelease.namespace`, and `Deployment`/`Service`/`Pod` label
selectors at your own project's charts and cluster namespace. Nothing
in the step implementations hardcodes Thomas's own `charts/` fixtures
or the `thomas-helm-test` namespace; those only appear in Thomas's own
`.feature` files.

See [BDD conventions](docs/concepts/bdd-conventions.md) and the
per-tool references ([Helm](docs/reference/HELM.md),
[Kubernetes](docs/reference/KUBECTL.md), [REST](docs/reference/REST.md))
for what's available once wired up.

## Documentation

- **[alexander.ilyin.eu/Thomas](https://alexander.ilyin.eu/Thomas/)** —
  the published, human-facing reference site: BDD conventions, and the
  Helm/Kubernetes/REST/Resources step catalogs, each with real
  `Short`/`Full` examples. Built from [`docs/`](docs/index.md) with
  MkDocs Material (`mkdocs build --strict`).
- **[`AGENTS.md`](AGENTS.md)** — canonical reference for any agent
  working in this repo: layout, conventions, known gotchas, current
  status. Start here.
- **[`.agents/skills/thomas/`](.agents/skills/thomas/SKILL.md)** — the
  same step catalogs, written for an agent to load before writing or
  extending a `.feature` file; `references/extending.md` is the
  from-scratch methodology for changing Thomas itself (alias resolution,
  the 6 table vocabularies, oneline/short-form siblings, the Payload/
  request accumulators, conditions, JMESPath).
