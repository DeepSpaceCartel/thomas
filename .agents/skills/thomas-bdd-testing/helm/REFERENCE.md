# Helm steps

Real `helm`/`tar` invocations against real (small, public) chart
repositories and a real cluster. See
[`../SKILL.md`](../SKILL.md) first for the general pattern this extends,
and [`../../extend-thomas/SKILL.md`](../../extend-thomas/SKILL.md)
for the underlying Alias/DataTable methodology.

## The four Helm alias types

- **`Directory`** (`support/aliases/directory.ts`) — a local path. Its
  `Given` does a real, read-only `fs.existsSync` check at construction.
- **`HelmChart`** (`support/helm/helm_chart.ts`) — a chart reference:
  `local-directory`, `local-archive`, `url`, `oci`, or `reference` (+
  optional `repo`). `chartRefToArgs()` is the one place that turns
  `chart.kind` into the right CLI argv fragment, reused by `template`,
  `show`, and `install`/`upgrade`.
- **`HelmRepo`** (`support/helm/helm_repo.ts`) — `repo add`/`remove`/
  `update`/`list`.
- **`HelmRelease`** (`support/helm/helm_release.ts`) — the one type whose `chart`
  field resolves to the real `HelmChart` **object**, not a string.

## Directory-scoped steps

```gherkin
When I index Directory known as "<Alias>" with:      # helm repo index <path>
When I lint Directory known as "<Alias>" with:        # helm lint <path>
When I package Directory known as "<Alias>" with:      # helm package <path>
When I purge Directory known as "<Alias>"              # filesystem only, no helm call
When I {build|list|update} dependencies for Directory known as "<Alias>" with:
```
`helm lint`/`helm package` only accept a **local path** — they take a
`Directory`, never a `HelmChart` (which can also be a URL/OCI/reference
that those subcommands can't operate on).

**In practice** (`features/helm/directory.feature`):
```gherkin
Given Directory known as "<NginxChartDirectory>":
  | PROPERTY | VALUE          |
  | path     | ./charts/nginx |
When I lint Directory known as "<NginxChartDirectory>" with:
  | OPTION | VALUE |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                 |
  | STDOUT | contains  | 1 chart(s) linted, 0 chart(s) failed |
```

Dependency management (`features/helm/dependency.feature`) exercises
`build`/`list`/`update` against `charts/test-dependency/`, a fixture
that exists solely to declare a real dependency:
```gherkin
When I update dependencies for Directory known as "<DependencyChartDirectory>" with:
  | OPTION | VALUE |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE           |
  | STDOUT | contains  | Saving 1 charts |
```

## HelmChart-scoped steps

```gherkin
Given Helm Chart known as "<Alias>":                       # PROPERTY|VALUE: chart, repo
Given Helm Chart known as "<Alias>" has:                    # KEY|CONDITION|VALUE against Chart.yaml
When I template Helm Chart known as "<Alias>" with:          # helm template [NAME] [CHART]
When I show {chart|values|readme|crds|all} for Helm Chart known as "<Alias>" with:
```
`helm show values`/`chart`/`crds` output YAML (assert with `the command
result data has:`). `helm show readme` is plain markdown and `helm get
all` has no `-o` flag at all — both use the raw-text `the command exited
with {int}:` form instead. Any table-supplied positional arg (a
blank-`OPTION` row) must come *before* the chart args in argv — confirmed
by actually running it; the wrong order gets the chart's own path parsed
as a stray extra arg.

**In practice**, defining the same chart from each of its five real
sources (`features/helm/helm-chart.feature`):
```gherkin
# Local directory
Given Directory known as "<NginxChartDirectory>":
  | PROPERTY | VALUE          |
  | path     | ./charts/nginx |
And Helm Chart known as "<LocalNginxHelmChart>":
  | PROPERTY | VALUE                 |
  | chart    | <NginxChartDirectory> |

# Chart reference via a registered repo name ("bitnami/nginx")
And Helm Chart known as "<ReferenceNginxHelmChart>":
  | PROPERTY | VALUE         |
  | chart    | bitnami/nginx |

# Bare name + a separate repo URL field
And Helm Chart known as "<RepoReferenceNginxHelmChart>":
  | PROPERTY | VALUE            |
  | chart    | nginx            |
  | repo     | <BitnamiRepoUrl> |
```
```gherkin
When I template Helm Chart known as "<LocalNginxHelmChart>" with:
  | OPTION | VALUE      |
  |        | test-nginx |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                   |
  | STDOUT | contains  | # Source: nginx/templates/service.yaml |
```

## HelmRepo-scoped steps

```gherkin
Given Helm Repo known as "<Alias>":                    # PROPERTY|VALUE: name, url
When I add Helm Repo known as "<Alias>" with:            # helm repo add <name> <url>
When I remove Helm Repo known as "<Alias>" with:          # helm repo remove <name>
When I update Helm Repo known as "<Alias>" with:          # helm repo update <name>
When I list Helm Repo with:                               # helm repo list (no alias - lists all)
```

**In practice** (`features/helm/helm-repo.feature`):
```gherkin
Given URL known as "<MetricsServerRepoUrl>":
  | PROPERTY | VALUE                                             |
  | value    | https://kubernetes-sigs.github.io/metrics-server/ |
And Helm Repo known as "<SandboxAddExampleRepo>":
  | PROPERTY | VALUE               |
  | name     | sandbox-add-example |
  | url      | <MetricsServerRepoUrl> |
When I add Helm Repo known as "<SandboxAddExampleRepo>" with:
  | OPTION                     | VALUE |
  | --insecure-skip-tls-verify | True  |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                               |
  | STDOUT | contains  | has been added to your repositories |
And I list Helm Repo with:
  | OPTION | VALUE |
  | -o     | yaml  |
Then the command result data has:
  | KEY      | CONDITION | VALUE               |
  | [*].name | equals    | sandbox-add-example |
```

## HelmRelease-scoped steps

```gherkin
Given HelmRelease known as "<Alias>":                                    # PROPERTY|VALUE: chart, name, namespace
When I {install|upgrade|uninstall|rollback|status|history|test} HelmRelease known as "<Alias>" with:
When I get {all|hooks|manifest|metadata|notes|values} for HelmRelease known as "<Alias>" with:
When I list HelmRelease with:                                             # helm list (no alias)
```
Only `install`/`upgrade` take a chart ref — the rest only ever take
`RELEASE_NAME -n NAMESPACE`.

**Literal `helm install` is genuinely not idempotent** — a second
install of the same release name errors (`cannot re-use a name that is
still in use`); that's real Helm behavior worth testing directly (see
`release.feature`'s "Rejecting a duplicate install"). The rerun-safe
idiom used everywhere else in this suite:
```gherkin
When I upgrade HelmRelease known as "<MyRelease>" with:
  | OPTION             | VALUE |
  | --install          | True  |
  | --atomic            | True  |
  | --create-namespace  | True  |
```
`--atomic` blocks until the rollout is healthy (or rolls back on
failure) — this is why `Deployment`/`Service` discovery right after an
`--atomic` upgrade never needs to poll (see the `kubectl/` reference).
Omit `--atomic` deliberately when a scenario needs to observe an
unhealthy in-between state (see the kubectl reference's fast-fail
example).

**In practice**, a full lifecycle (`features/helm/release.feature`):
```gherkin
Given HelmRelease known as "<NginxRelease>":
  | PROPERTY  | VALUE                 |
  | chart     | <NginxHelmChart>      |
  | name      | sandbox-nginx-release |
  | namespace | thomas-helm-test    |
When I upgrade HelmRelease known as "<NginxRelease>" with:
  | OPTION             | VALUE |
  | --install          | True  |
  | --atomic            | True  |
  | --create-namespace  | True  |
Then the command exited with 0
When I status HelmRelease known as "<NginxRelease>" with:
  | OPTION | VALUE |
  | -o     | yaml  |
Then the command result data has:
  | KEY         | CONDITION | VALUE    |
  | info.status | equals    | deployed |
...
When I uninstall HelmRelease known as "<NginxRelease>" with:
  | OPTION | VALUE |
Then the command exited with 0
```

## Fixture charts (`Thomas/charts/`)

- `nginx/` — minimal, off-the-shelf `nginx` image. Its label set covers
  every "recommended" label from Helm's chart-best-practices guide;
  `app.kubernetes.io/version` **must** be rendered `| quote`d, or a bare
  numeric-looking `AppVersion` (e.g. `1.27`) parses as YAML float and
  `helm upgrade` fails outright.
- `test-dependency/` — exists solely to exercise `helm dependency
  build/list/update` against a real `metrics-server` dependency.
- `rest-api/` — a real FastAPI app; see `../fastapi-test-fixture/SKILL.md`.

`charts/nginx-0.1.0.tgz` is regenerated fresh from `charts/nginx/`
before every run (a `BeforeAll` hook, real `helm package`), so "Local
Archive Chart" scenarios can never silently test stale content.
