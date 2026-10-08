# Helm steps

Real `helm`/`tar` invocations against real (small, public) chart
repositories and a real cluster. See [`../SKILL.md`](../SKILL.md) first
for the general pattern this extends, and
[`extending.md`](extending.md) for the underlying Alias/DataTable
methodology.

## The four Helm-domain types

- **`Directory`** (`support/resources/directory.ts`) — a local path. Its
  `Given` does a real, read-only `fs.existsSync` check at construction.
- **Chart** (`support/helm/helm_chart.ts`, class `HelmChart`) — a chart
  reference: `local-directory`, `local-archive`, `url`, `oci`, or
  `reference` (+ optional `repo`). `chartRefToArgs()` is the one place
  that turns `chart.kind` into the right CLI argv fragment, reused by
  `template`, `show`, and `install`/`upgrade`.
- **Repository** (`support/helm/helm_repo.ts`, class `HelmRepo`) —
  `repo add`/`remove`/`update`/`list`.
- **Release** (`support/helm/helm_release.ts`, class `HelmRelease`) —
  the one type whose `chart` field resolves to the real Chart
  **object**, not a string.

## Directory-scoped steps

```gherkin
Given Directory "<Alias>" at "<path>"
Given Directory known as "<Alias>":                    # PROPERTY|VALUE: path

When I index Directory known as "<Alias>" with:      # helm repo index <path>
When I index Directory "<Alias>" with {flags}
When I lint Directory known as "<Alias>" with:        # helm lint <path>
When I lint Directory "<Alias>" with {flags}
When I package Directory known as "<Alias>" with:      # helm package <path>
When I package Directory "<Alias>" with {flags}
When I purge Directory known as "<Alias>"              # filesystem only, no helm call
When I create Directory known as "<Alias>" at "<path>" # filesystem only, real mkdir -p
When I {build|list|update} dependencies for Directory known as "<Alias>" with:
When I {build|list|update} dependencies for Directory "<Alias>" with {flags}
```

`File` (`support/resources/file.ts`) has one real command of its own too,
filesystem-only like `Directory`'s purge/create:
```gherkin
When I create File known as "<Alias>" at "<path>" with:  # real mkdir -p + write
  """
  <real content>
  """
```
`helm lint`/`helm package` only accept a **local path** — they take a
`Directory`, never a Chart (which can also be a URL/OCI/reference that
those subcommands can't operate on).

**In practice** — short oneline, and the full `DataTable` it's
equivalent to:
```gherkin
Given Directory "<ChartsDirectory>" at "./charts"
```
```gherkin
Given Directory known as "<ChartsDirectory>":
  | PROPERTY | VALUE    |
  | path     | ./charts |
```
Negative-path tests (an unknown field) reach for a real [Payload
accumulator](../../../../docs/concepts/bdd-conventions.md#construction)
instead of a live table — `Given "<Alias>" field "<key>" is "<value>"`
repeated, then `When I attempt to define Directory known as "<Alias>"
using "<PayloadAlias>"`, reusing the exact same real `new Directory(...)`
constructor the table form calls.

```gherkin
Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
When I lint Directory "<NginxChartDirectory>" with --strict
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                 |
  | STDOUT | contains  | 1 chart(s) linted, 0 chart(s) failed |
```

Dependency management (`features/helm/dependency-{short,full}.feature`) exercises
`build`/`list`/`update` against `charts/test-dependency/`, a fixture
that exists solely to declare a real dependency:
```gherkin
When I update dependencies for Directory known as "<DependencyChartDirectory>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE           |
  | STDOUT | contains  | Saving 1 charts |
```

Every `... with:` step above also has a table-less sibling (`When I
lint Directory known as "<Alias>"`, etc.) and a `with {flags}` short
sibling — use the table-less form when there are no real flags to pass,
and `with {flags}` instead of `with:` when there are just a few.

## Chart-scoped steps

```gherkin
Given Helm Chart "<Alias>" in "<source>"
Given Helm Chart "<Alias>" in "<source>" version "<version>"
Given Helm Chart "<Alias>" in "<source>" repo "<repo>" version "<version>"
Given Helm Chart known as "<Alias>":                       # PROPERTY|VALUE: chart, repo, version
Given Helm Chart known as "<Alias>" has:                    # KEY|CONDITION|VALUE against Chart.yaml
Given Helm Chart "<Alias>" has "<key>" <condition> <value>   # oneline sibling - {word}/{string} value, or value-less for exists/undefined
When I template Helm Chart known as "<Alias>" with:          # helm template [NAME] [CHART]
When I template Helm Chart "<Alias>" with {flags}
When I show {chart|values|readme|crds|all} for Helm Chart known as "<Alias>" with:
When I show {chart|values|readme|crds|all} for Helm Chart "<Alias>" with {flags}
```
`version` is only valid for the "reference" source kind (`source`
alone, or `source`+`repo`) — setting it on a local/URL/OCI source fails
loudly rather than being silently ignored (those are already pinned by
what they point at). `helm show values`/`chart`/`crds` output YAML
(assert with `the command result data has:`). `helm show readme` is
plain markdown and `helm get all` has no `-o` flag at all — both use the
raw-text `the command exited with {int}:` form instead. Any
table-supplied positional arg (a blank-`OPTION` row, or a bare token in
the `{flags}` form) must come *before* the chart args in argv —
confirmed by actually running it; the wrong order gets the chart's own
path parsed as a stray extra arg.

**In practice**, defining the same chart from each of its five real
sources (`features/helm/helm-chart-short.feature`; see
`helm-chart-full.feature` for the same flow in full table syntax):
```gherkin
# Local directory
Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"

# Chart reference via a registered repo name ("bitnami/nginx"), pinned
And Helm Chart "<ReferenceNginxHelmChart>" in "bitnami/nginx" version "25.1.10"

# Bare name + a separate repo URL field, pinned
And Helm Chart "<RepoReferenceNginxHelmChart>" in "nginx" repo "<BitnamiRepoUrl>" version "25.1.10"
```
The same "Bare name + repo" source as the full `DataTable` form:
```gherkin
Given Helm Chart known as "<RepoReferenceNginxHelmChart>":
  | PROPERTY | VALUE            |
  | chart    | nginx            |
  | repo     | <BitnamiRepoUrl> |
  | version  | 25.1.10          |
```
```gherkin
When I template Helm Chart "<LocalNginxHelmChart>" with test-nginx
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                   |
  | STDOUT | contains  | # Source: test-nginx/templates/service.yaml |
```

## Repository-scoped steps

```gherkin
Given Helm Repo "<Alias>" named "<name>" at "<url>"
Given Helm Repo known as "<Alias>":                    # PROPERTY|VALUE: name, url
When I add Helm Repo known as "<Alias>" with:            # helm repo add <name> <url>
When I add Helm Repo "<Alias>" with {flags}
When I remove Helm Repo known as "<Alias>" with:          # helm repo remove <name>
When I remove Helm Repo "<Alias>" with {flags}
When I update Helm Repo known as "<Alias>" with:          # helm repo update <name>
When I update Helm Repo "<Alias>" with {flags}
When I list Helm Repo with:                               # helm repo list (no alias - lists all)
When I list Helm Repo with {flags}
```

**In practice** — short oneline, and the full `DataTable` it's
equivalent to:
```gherkin
Given Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "<BitnamiRepoUrl>"
```
```gherkin
Given Helm Repo known as "<BitnamiHelmRepo>":
  | PROPERTY | VALUE            |
  | name     | bitnami          |
  | url      | <BitnamiRepoUrl> |
```

(`features/helm/helm-repo-short.feature`; see
`helm-repo-full.feature` for the same flow in full table syntax):
```gherkin
Given URL "<MetricsServerRepoUrl>" at "https://kubernetes-sigs.github.io/metrics-server/"
And Helm Repo "<ThomasAddExampleRepo>" named "thomas-add-example" at "<MetricsServerRepoUrl>"
When I add Helm Repo "<ThomasAddExampleRepo>" with --insecure-skip-tls-verify
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                               |
  | STDOUT | contains  | has been added to your repositories |
And I list Helm Repo with --output yaml
Then the command result data has:
  | KEY      | CONDITION | VALUE              |
  | [*].name | equals    | thomas-add-example |
```

## Release-scoped steps

```gherkin
Given Helm Release "<Alias>" of "<chart>" named "<name>" in "<namespace>"
Given Helm Release known as "<Alias>":                                    # PROPERTY|VALUE: chart, name, namespace
When I {install|upgrade|uninstall|rollback|status|history|test} Helm Release known as "<Alias>" with:
When I {install|upgrade|uninstall|rollback|status|history|test} Helm Release "<Alias>" with {flags}
When I get {word} of Helm Release "<Alias>" as {outputFormat}              # e.g. status/history - shorthand for --output json/yaml
When I get {all|hooks|manifest|metadata|notes|values} for Helm Release known as "<Alias>" with:
When I get {all|hooks|manifest|metadata|notes|values} for Helm Release "<Alias>" with {flags}
When I get {all|hooks|manifest|metadata|notes|values} for Helm Release "<Alias>" as {outputFormat}
When I list Helm Release with:                                             # helm list (no alias)
When I list Helm Release with {flags}
Then Helm Release "<Alias>" is "<status>"                                  # info.status equals <status>, against a prior "as YAML"/"with --output yaml" status call
```
Only `install`/`upgrade` take a chart ref — the rest only ever take
`RELEASE_NAME -n NAMESPACE`. The two `as {outputFormat}` forms use
different literal prepositions on purpose — `of` for the verb dispatch
(`status`/`history`/...), `for` for the `helm get <sub>` subcommand
(`values`/`metadata`/...) — different real commands under the hood, so
worth not conflating even though they read similarly; see
[`extending.md`](extending.md#as-jsonas-yaml-output-format-shorthand).

**Literal `helm install` is genuinely not idempotent** — a second
install of the same release name errors (`cannot re-use a name that is
still in use`); that's real Helm behavior worth testing directly (see
`release-short.feature`/`release-full.feature`'s "Rejecting a duplicate
install"). The rerun-safe
idiom used everywhere else in this suite:
```gherkin
When I upgrade Helm Release "<MyRelease>" with --install --atomic --create-namespace
```
`--atomic` blocks until the rollout is healthy (or rolls back on
failure) — this is why `Deployment`/`Service` discovery right after an
`--atomic` upgrade never needs to poll (see [`kubectl.md`](kubectl.md)).
Omit `--atomic` deliberately when a scenario needs to observe an
unhealthy in-between state (see the kubectl reference's fast-fail
example).

**In practice** — short oneline, and the full `DataTable` it's
equivalent to:
```gherkin
Given Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "thomas-nginx-release" in "thomas-helm-test"
```
```gherkin
Given Helm Release known as "<NginxRelease>":
  | PROPERTY  | VALUE                 |
  | chart     | <NginxHelmChart>      |
  | name      | thomas-nginx-release  |
  | namespace | thomas-helm-test      |
```

A full lifecycle (`features/helm/release-short.feature`;
see `release-full.feature` for the same flow in full table syntax):
```gherkin
Given Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "thomas-nginx-release" in "thomas-helm-test"
When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
Then the command exited with 0
When I status Helm Release known as "<NginxRelease>" with:
  | OPTION   | VALUE |
  | --output | yaml  |
Then the command result data has:
  | KEY         | CONDITION | VALUE    |
  | info.status | equals    | deployed |
...
When I uninstall Helm Release known as "<NginxRelease>"
Then the command exited with 0
```

**In practice, the short-form/`as YAML`/status-shorthand combination**
(`features/quickstart.feature`):
```gherkin
When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
Then the command succeeds
When I get status of Helm Release "<NginxRelease>" as YAML
Then Helm Release "<NginxRelease>" is "deployed"
...
When I uninstall Helm Release known as "<NginxRelease>"
Then the command exited with 0 STDOUT contains uninstalled
```
`the command succeeds` (`common.step.ts`) is a plain-English alias for
`the command exited with 0` specifically — `the command exited with
{int}` stays the form for a real nonzero-exit assertion elsewhere.

Every step above (verb dispatch, `get`, `list`, and every Helm-scoped
step earlier in this file) has a table-less sibling and a `with {flags}`
short sibling.

## Fixture charts (`Thomas/charts/`)

- `test-nginx/` — minimal, off-the-shelf `nginx` image. Its label set
  covers every "recommended" label from Helm's chart-best-practices
  guide; `app.kubernetes.io/version` **must** be rendered `| quote`d, or
  a bare numeric-looking `AppVersion` (e.g. `1.27`) parses as YAML float
  and `helm upgrade` fails outright.
- `test-dependency/` — exists solely to exercise `helm dependency
  build/list/update` against a real `metrics-server` dependency.
- `test-rest-api/` — a real FastAPI app; see `charts/test-rest-api/README.md`.
- `test-tls-demo/` — a namespaced, self-signed cert-manager `Issuer` +
  `Certificate` fixture, used by the kubectl domain's TLS
  certificate-inspection steps (see [`kubectl.md`](kubectl.md)). Uses
  `spec.selfSigned: {}` deliberately — this cluster's real
  `ClusterIssuer` is wired to a production Let's Encrypt account over
  real Route53 DNS-01, and a fixture chart requesting a certificate from
  *that* issuer would issue a real production certificate on every test
  run.

`charts/test-nginx-0.1.0.tgz` is regenerated fresh from
`charts/test-nginx/` before every run (a `BeforeAll` hook, real `helm
package`), so "Local Archive Chart" scenarios can never silently test
stale content.
