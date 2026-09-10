# CI

Two tiers, on purpose — one runs for literally anyone (including a
fork PR), the other needs real cluster access and only runs for
trusted branches.

## Fast tier: `ci.yaml` (GitHub-hosted, every push/PR)

Type-check, `cucumber-js --dry-run` (confirms every step resolves, no
ambiguity — but runs no real command), and `mkdocs build --strict`.
GitHub-hosted runners have no network path into the real cluster
Thomas's suite actually needs, so this tier deliberately never touches
one — safe to run unconditionally for any contributor.

## Real tier: `real-tests.yml` (self-hosted, gated)

Runs the actual `npm test` — real `helm`/`kubectl`/HTTP calls against a
real cluster, deploying into and cleaning up `thomas-helm-test` the
same way a local run does (see `AGENTS.md`).

```yaml
on:
  push:
    branches: [main]
  pull_request:
```

Gated with `if: github.event_name == 'push' ||
github.event.pull_request.head.repo.full_name == github.repository` —
**never runs for a fork PR**. Thomas is public, so any GitHub user can
open one, and the runner pod's own in-cluster identity has real write
access to the cluster (see below) — not something a fork PR's workflow
run is trusted with.

`concurrency: {group: real-tests, cancel-in-progress: false}` —
serializes every run. `thomas-helm-test` is one fixed, shared
namespace (not one per run), and this cluster has already shown real
fragility under concurrent/shared use elsewhere on it — see
`rts-turbo`'s own `ci.yml` for the same tradeoff made the same way.

### Runner: self-hosted, inside the cluster

`runs-on: thomas` — a dedicated actions-runner-controller (ARC) scale
set, a pod living *inside* the same real cluster the tests target
(GitHub-hosted runners can't reach it: no network path in). Provisioned
outside this repo, same as `rts-turbo`'s own scale set — see the
Terraform handoff for the exact shape.

### Cluster access: the runner pod's own in-cluster identity

No kubeconfig secret — the ARC runner pod authenticates as whatever
Kubernetes `ServiceAccount` it's bound to run as, the same way any
in-cluster pod does (`kubectl`/`helm` pick this up automatically from
the pod's mounted service account token, no explicit `KUBECONFIG` env
needed). That `ServiceAccount` is **namespace-scoped** — not
cluster-admin, not even close to what a maintainer's own workspace
kubeconfig can do. Scoped to exactly `thomas-helm-test`, exactly the
resource kinds the suite/fixtures actually touch:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: thomas-ci
  namespace: thomas-helm-test
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: thomas-ci
  namespace: thomas-helm-test
rules:
  - apiGroups: ["", "apps", "cert-manager.io"]
    resources: ["*"]
    verbs: ["*"]
  - apiGroups: [""]
    resources: ["pods/exec", "pods/log"]
    verbs: ["get", "create"]
  - apiGroups: [""]
    resources: ["serviceaccounts"]
    verbs: ["impersonate"] # `kubectl auth can-i ... --as=` (the RBAC-check steps)
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: thomas-ci
  namespace: thomas-helm-test
subjects:
  - kind: ServiceAccount
    name: thomas-ci
    namespace: thomas-helm-test
roleRef:
  kind: Role
  name: thomas-ci
  apiGroup: rbac.authorization.k8s.io
```

`""`/`apps`/`cert-manager.io` cover every kind the suite/fixtures
actually touch (`Deployment`/`Service`/`Pod`/`ConfigMap`/`ReplicaSet`/
`Secret`/`Events`, plus `test-tls-demo`'s `Issuer`/`Certificate`).
Deliberately **excludes** `rbac.authorization.k8s.io` — Thomas never
creates `Role`s/`RoleBinding`s itself, only reads existing permissions
via `impersonate` (the [RBAC check step](../reference/KUBECTL.md#checking-rbac-permissions)
does `kubectl auth can-i ... --as=system:serviceaccount:...`, which
needs `impersonate` on the target, not a grant of what it's checking).
Assumes
`thomas-helm-test` already exists — this scoped `ServiceAccount` can't
create namespaces itself.

### `@requires-broad-rbac`: scenarios that deliberately can't run here

`real-tests.yml` runs with `--tags "not @requires-broad-rbac"`.
`features/quickstart.feature` carries that tag — it deliberately deploys
into a `dev` namespace (the whole point: showing the pattern isn't tied
to Thomas's own `thomas-helm-test` convention), which the narrowly-scoped
`thomas-ci` `ServiceAccount` above has no access to at all. Confirmed for
real, not assumed: before the tag existed, the CI run failed with
`secrets is forbidden: User "system:serviceaccount:arc-runners:thomas-ci"
cannot list resource "secrets" ... in the namespace "dev"` — a real RBAC
error `command_log.ts`'s full output surfaced immediately, where
Cucumber's own truncated failure preview had shown only an unrelated
`--atomic` deprecation warning that happened to print to the same STDERR
first. Widening the CI `ServiceAccount` to cover an arbitrary second
namespace just for one demo scenario isn't worth trading away the
narrow-RBAC guarantee above for — this scenario still runs for anyone
with broader cluster access, same as before.

## Tool versions: `scripts/tools.sh` (`npm run install:tools`)

Both workflows install `helm`/`kubectl` via `npm run install:tools`
(`scripts/tools.sh`) instead of the `azure/setup-helm`/`azure/setup-kubectl`
Actions — the same script a contributor runs locally, so CI and dev
always run the literal same install logic rather than two independently
"latest"-resolving mechanisms that can silently diverge. That divergence
happened for real once: an early version of `real-tests.yml` used
`azure/setup-helm@v5` with `version: latest`, which installed **Helm
v4** the same week this whole suite had only ever been built and
verified against **Helm v3** — six of the eight scenarios that failed
in that first real CI run trace back to real v3→v4 behavior changes
(`--atomic` deprecated in favor of `--rollback-on-failure`, the
`--fail-on-repo-update-fail` flag removed, `Chart.lock` dependency
resolution changed, and the real "duplicate install" error text
changing from "cannot re-use a name" to "cannot reuse a name"). The
fix wasn't pinning CI down to v3 — it was making dev track the same
real latest version CI does, via one shared script, so this class of
drift can't recur.

## `openssl`: pinned output format, not a version

Real, separate issue from the Helm mismatch: `features/step_definitions/
k8s/kubernetes.step.ts`'s certificate-inspection step calls `openssl
x509 -subject`, and OpenSSL's own unflagged default subject-line format
(spaces around `=` or not) varies by OS/build — confirmed for real: this
project's dev sandbox and an early CI runner image produced different
output for the identical real certificate. `openssl` is an OS-provided
library, not a droppable static binary like `helm`/`kubectl`, so
`scripts/tools.sh` can't pin it the same way. The step instead passes
`-nameopt RFC2253`, an explicit, version-independent format, so the
assertion doesn't depend on which environment's OpenSSL happened to run
it. **Revisit this once CI runs the same container image as local dev**
(tracked as a future Dev Containers migration) — at that point dev and
CI share one real OpenSSL build and the explicit flag stops being
load-bearing, though there's no harm in leaving it.

## Full command output: one log file per scenario

Every scenario gets its own file under `test-results/` (see
`features/support/command_log.ts`, wired up via a `Before` hook in
`features/support/hooks.ts`) holding the real, untruncated STDOUT/STDERR
of every `helm`/`kubectl`/etc. command that scenario ran — not just the
truncated preview Cucumber's own failure messages show. Filenames are
keyed by the feature file's path plus a monotonically incrementing
counter, never the scenario's own name or line number — a Scenario
Outline expands into several pickles sharing one title, and unrelated
feature files can reuse the same name, so a name-based filename could
silently overwrite another scenario's log. This runs in every `npm
test`/`npm run test:verbose` invocation, local dev included, not just
CI. `real-tests.yml` publishes the whole `test-results/` directory as a
build artifact (`scenario-logs`, 7-day retention) on every run, pass or
fail — so a passing run's real output is just as inspectable as a
failing one's, not only recoverable after something breaks.

## `cleanup-stale-releases.yml`

Hourly safety net for `real-tests.yml`'s own `if: always()` teardown
step, which runs on a graceful cancel but not a hard job timeout or a
runner crash mid-run. Since `thomas-helm-test` is one fixed namespace
(not one per run), anything left behind past a 1-hour cutoff is
unambiguously stale — nothing else could legitimately still be using
it (`real-tests.yml`'s own job timeout is 30 minutes). Sweeps both
stale Helm releases and orphaned `Secret`s Helm doesn't own (e.g.
`test-tls-demo`'s cert-manager-issued one — `helm uninstall` only
removes what Helm itself templated).

## `docs.yaml`: avoiding the duplicate-artifact failure on a re-run

`actions/deploy-pages` fails with "Multiple artifacts named github-pages
were unexpectedly found" if this workflow is ever re-run via GitHub's
own "Re-run failed jobs" — `upload-pages-artifact` re-uploads under the
same fixed name (`github-pages`) on the new attempt, and the previous
attempt's artifact is never cleaned up, so `deploy-pages` finds two and
refuses to pick one. Confirmed for real (`gh api .../artifacts` showed
two `github-pages` artifacts under one `run_id`, `run_attempt: 2`).
`docs.yaml` now deletes any `github-pages` artifact left by an earlier
attempt of the *same* run before uploading a fresh one — gated on
`github.run_attempt != '1'`, so it's a no-op on the common case (a
normal, first-attempt run) and only does anything on an actual re-run.

## What's provisioned where

This repo only has the workflow files themselves — the actual ARC scale
set and the `ServiceAccount`/`Role`/`RoleBinding` the runner pod
authenticates as are provisioned cluster-side, the same way
`rts-turbo`'s own runner is (Terraform, in a separate repo, not this
one).
