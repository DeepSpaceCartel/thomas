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
open one; GitHub already withholds secrets from fork-originated
`pull_request` runs (not `pull_request_target`, which this isn't), so
`THOMAS_CI_KUBECONFIG` would just be empty there regardless — the
explicit check turns that into a readable skip instead of a confusing
empty-secret failure.

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

### The `THOMAS_CI_KUBECONFIG` secret

A GitHub Actions secret holding a kubeconfig for a **namespace-scoped**
`ServiceAccount` — not cluster-admin, not even close to what a
maintainer's own workspace kubeconfig can do. Scoped to exactly
`thomas-helm-test`, exactly the resource kinds the suite/fixtures
actually touch:

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

## What's provisioned where

This repo only has the two workflow files above — the actual ARC scale
set, `ServiceAccount`/`Role`/`RoleBinding`, and the
`THOMAS_CI_KUBECONFIG` secret's value are provisioned cluster-side, the
same way `rts-turbo`'s own runner is (Terraform, in a separate repo,
not this one). Both workflows are inert (queue forever / fail on a
missing runner) until that's done.
