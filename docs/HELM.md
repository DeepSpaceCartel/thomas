# Helm

Real `helm`/`tar` invocations against real (small, public) chart
repositories and a real cluster — nothing here is mocked. See [BDD
conventions](bdd-conventions.md) for the "define, then act" pattern and
table shapes these steps build on.

## Directory

Steps scoped to a local filesystem path: index, lint, package, and
manage dependencies.

### Define a Directory

```gherkin
Given Directory known as "<Alias>":
```

Registers a local filesystem path, checked to really exist at
construction time. The base object every other Helm step in this
section either wraps directly (`HelmChart`) or operates on.

=== "Minimal"

    ```gherkin
    Given Directory known as "<ChartsDirectory>":
      | PROPERTY | VALUE    |
      | path     | ./charts |
    ```

=== "In practice"

    ```gherkin
    Given Directory known as "<ChartsDirectory>":
      | PROPERTY | VALUE    |
      | path     | ./charts |
    When I index Directory known as "<ChartsDirectory>" with:
      | OPTION | VALUE |
    Then the command exited with 0
    ```

### Index a Directory

```gherkin
When I index Directory known as "<Alias>" with:
```

Runs `helm repo index <path>` against the directory.

```gherkin
When I index Directory known as "<ChartsDirectory>" with:
  | OPTION | VALUE |
```

### Lint a Directory

```gherkin
When I lint Directory known as "<Alias>" with:
```

Runs `helm lint <path>`. Only accepts a local path — a `Directory`,
never a `HelmChart` (which can also be a URL/OCI/reference that `lint`
can't operate on).

=== "Minimal"

    ```gherkin
    When I lint Directory known as "<NginxChartDirectory>" with:
      | OPTION | VALUE |
    ```

=== "In practice"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    When I lint Directory known as "<NginxChartDirectory>" with:
      | OPTION | VALUE |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                |
      | STDOUT | contains  | 1 chart(s) linted, 0 chart(s) failed |
    ```

    (`features/helm/directory.feature`)

### Package a Directory

```gherkin
When I package Directory known as "<Alias>" with:
```

Runs `helm package <path>`, same local-path-only restriction as `lint`.

```gherkin
When I package Directory known as "<NginxChartDirectory>" with:
  | OPTION | VALUE  |
  | -d     | .cache |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                       |
  | STDOUT | contains  | Successfully packaged chart |
```

### Purge a Directory

```gherkin
When I purge Directory known as "<Alias>"
```

Empties the directory's contents on disk (except `.gitkeep`). A pure
filesystem operation, no `helm` invocation — used to restore a genuine
"nothing downloaded yet" precondition before a dependency scenario.

```gherkin
When I purge Directory known as "<DownloadsDirectory>"
```

### Manage Directory Dependencies

```gherkin
When I {build|list|update} dependencies for Directory known as "<Alias>" with:
```

Runs `helm dependency build|list|update <path>` against a chart
directory declaring real dependencies.

```gherkin
When I list dependencies for Directory known as "<DependencyChartDirectory>" with:
  | OPTION | VALUE |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE   |
  | STDOUT | contains  | missing |
When I update dependencies for Directory known as "<DependencyChartDirectory>" with:
  | OPTION | VALUE |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE           |
  | STDOUT | contains  | Saving 1 charts |
```

(`features/helm/dependency.feature`, against `charts/test-dependency/`,
a fixture that exists solely to exercise this step)

## Chart & Repo Sources

`File`, `URL`, and `OCIArtifact` have no `helm` commands of their own —
they exist purely to be referenced as a `HelmChart`'s `chart`/`repo`
field (`URL` also feeds a `HelmRepo`'s `url`). `Directory` is the fourth
source kind but gets its own group above, since it also has real
commands (`index`/`lint`/`package`/dependency management).

### Define a File

```gherkin
Given File known as "<Alias>":
```

A local file path, checked to really exist at construction time —
typically a packaged chart archive (`.tgz`) used as a `HelmChart`'s
`local-archive` source.

=== "Basic"

    ```gherkin
    Given File known as "<NginxChartFile>":
      | PROPERTY | VALUE                    |
      | path     | ./charts/nginx-0.1.0.tgz |
    ```

=== "Advanced"

    ```gherkin
    Given File known as "<NginxChartFile>":
      | PROPERTY | VALUE                    |
      | path     | ./charts/nginx-0.1.0.tgz |
    And Helm Chart known as "<LocalArchiveNginxHelmChart>":
      | PROPERTY | VALUE            |
      | chart    | <NginxChartFile> |
    ```

    A chart sourced from a local archive instead of a directory
    (`features/helm/helm-chart.feature`).

### Define a URL

```gherkin
Given URL known as "<Alias>":
```

An `http(s)://` URL, validated as well-formed at construction time.
Used as a `HelmChart`'s `url` source or a `HelmRepo`'s `url`.

=== "Basic"

    ```gherkin
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    ```

=== "Advanced"

    ```gherkin
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    And Helm Repo known as "<BitnamiHelmRepo>":
      | PROPERTY | VALUE            |
      | name     | bitnami          |
      | url      | <BitnamiRepoUrl> |
    ```

    The same `URL` alias feeding a `HelmRepo`
    (`features/helm/helm-chart.feature`).

### Define an OCIArtifact

```gherkin
Given OCIArtifact known as "<Alias>":
```

An OCI registry reference (`oci://...`), validated for the correct
scheme at construction time. Used as a `HelmChart`'s `oci` source.

=== "Basic"

    ```gherkin
    Given OCIArtifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                          |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx |
    ```

=== "Advanced"

    ```gherkin
    Given OCIArtifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                          |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx |
    And Helm Chart known as "<OciNginxHelmChart>":
      | PROPERTY | VALUE              |
      | chart    | <NginxOciArtifact> |
    And Helm Chart known as "<OciNginxHelmChart>" has:
      | KEY     | CONDITION | VALUE   |
      | version | equals    | 25.1.10 |
    ```

    (`features/helm/helm-chart.feature`)

## HelmChart

Steps scoped to a chart reference: define it from any of five real
sources, assert on its `Chart.yaml`, template it, or inspect it with
`helm show`.

### Define a HelmChart

```gherkin
Given Helm Chart known as "<Alias>":
```

Registers a chart reference — a local directory, a local archive, a
URL, an OCI artifact, or a `repo/name` reference (optionally built from
a bare name plus a separate `repo` field). `chart`/`repo` fields accept
either a literal value or a `<Directory>`/`<File>`/`<URL>`/`<OCIArtifact>`
alias (see above). All five source kinds, each pulled from a real
scenario in `features/helm/helm-chart.feature`:

=== "Local Directory"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    ```

=== "Local Archive"

    ```gherkin
    Given File known as "<NginxChartFile>":
      | PROPERTY | VALUE                    |
      | path     | ./charts/nginx-0.1.0.tgz |
    And Helm Chart known as "<LocalArchiveNginxHelmChart>":
      | PROPERTY | VALUE            |
      | chart    | <NginxChartFile> |
    ```

=== "URL"

    ```gherkin
    Given URL known as "<NginxChartUrl>":
      | PROPERTY | VALUE                                               |
      | value    | https://charts.bitnami.com/bitnami/nginx-18.2.5.tgz |
    And Helm Chart known as "<UrlNginxHelmChart>":
      | PROPERTY | VALUE           |
      | chart    | <NginxChartUrl> |
    ```

=== "Reference"

    ```gherkin
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    And Helm Chart known as "<RepoReferenceNginxHelmChart>":
      | PROPERTY | VALUE            |
      | chart    | nginx            |
      | repo     | <BitnamiRepoUrl> |
    ```

=== "OCI"

    ```gherkin
    Given OCIArtifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                          |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx |
    And Helm Chart known as "<OciNginxHelmChart>":
      | PROPERTY | VALUE              |
      | chart    | <NginxOciArtifact> |
    ```

### Assert on a HelmChart's Chart.yaml

```gherkin
Given Helm Chart known as "<Alias>" has:
```

Asserts against the chart's real, parsed `Chart.yaml` — `KEY|CONDITION|VALUE`.

```gherkin
And Helm Chart known as "<LocalNginxHelmChart>" has:
  | KEY         | CONDITION | VALUE       |
  | apiVersion  | equals    | v2          |
  | name        | equals    | nginx       |
  | version     | equals    | 0.1.0       |
```

### Template a HelmChart

```gherkin
When I template Helm Chart known as "<Alias>" with:
```

Runs `helm template [NAME] [CHART]`. Any table-supplied positional arg
(a blank-`OPTION` row) must come *before* the chart args — the wrong
order gets the chart's own path parsed as a stray extra arg.

```gherkin
When I template Helm Chart known as "<LocalNginxHelmChart>" with:
  | OPTION | VALUE      |
  |        | test-nginx |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                   |
  | STDOUT | contains  | # Source: nginx/templates/service.yaml |
```

### Show HelmChart Info

```gherkin
When I show {chart|values|readme|crds|all} for Helm Chart known as "<Alias>" with:
```

Runs `helm show <sub> [CHART]`. `chart`/`values`/`crds` output YAML
(assert with `the command result data has:`); `readme` is plain
markdown and `all` has no `-o` flag at all — both use the raw-text `the
command exited with {int}:` form instead.

```gherkin
When I show values for Helm Chart known as "<LocalNginxHelmChart>" with:
  | OPTION | VALUE |
Then the command result data has:
  | KEY          | CONDITION | VALUE |
  | replicaCount | equals    | 1     |
```

## HelmRepo

Steps scoped to a chart repository: define it, then add/remove/update/list
it via `helm repo`.

### Define a HelmRepo

```gherkin
Given Helm Repo known as "<Alias>":
```

Registers a repository's real `name`/`url` — pure construction, no
`helm repo add` yet.

=== "Basic"

    ```gherkin
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    And Helm Repo known as "<BitnamiHelmRepo>":
      | PROPERTY | VALUE            |
      | name     | bitnami          |
      | url      | <BitnamiRepoUrl> |
    ```

=== "Advanced"

    ```gherkin
    When I add Helm Repo known as "<BitnamiHelmRepo>" with:
      | OPTION | VALUE |
    And Helm Chart known as "<ReferenceNginxHelmChart>":
      | PROPERTY | VALUE         |
      | chart    | bitnami/nginx |
    ```

    Registering the repo for real, then referencing it by its registered
    `name/chart` string from a `HelmChart` — the alternative to the
    bare-name-plus-`repo`-field form shown in the "Reference" tab above
    (`features/helm/helm-chart.feature`).

### Add a HelmRepo

```gherkin
When I add Helm Repo known as "<Alias>" with:
```

Runs `helm repo add <name> <url>`.

```gherkin
When I add Helm Repo known as "<SandboxAddExampleRepo>" with:
  | OPTION                     | VALUE |
  | --insecure-skip-tls-verify | True  |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                               |
  | STDOUT | contains  | has been added to your repositories |
```

(`features/helm/helm-repo.feature`)

### Remove a HelmRepo

```gherkin
When I remove Helm Repo known as "<Alias>" with:
```

Runs `helm repo remove <name>`.

```gherkin
When I remove Helm Repo known as "<SandboxRemoveExampleRepo>" with:
  | OPTION | VALUE |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                    |
  | STDOUT | contains  | has been removed from your repositories |
```

### Update a HelmRepo

```gherkin
When I update Helm Repo known as "<Alias>" with:
```

Runs `helm repo update <name>`.

```gherkin
When I update Helm Repo known as "<MetricsServerHelmRepo>" with:
  | OPTION                     | VALUE |
  | --fail-on-repo-update-fail | True  |
Then the command exited with 0
```

### List HelmRepos

```gherkin
When I list Helm Repo with:
```

Runs `helm repo list` (no alias — lists every registered repo).

```gherkin
When I list Helm Repo with:
  | OPTION | VALUE |
  | -o     | yaml  |
Then the command result data has:
  | KEY      | CONDITION | VALUE   |
  | [*].name | equals    | bitnami |
```

## HelmRelease

Steps scoped to a Helm release: define it, then install/upgrade/roll
back/inspect/list it.

### Define a HelmRelease

```gherkin
Given HelmRelease known as "<Alias>":
```

Registers a release's `chart` (resolved to the real `HelmChart` object),
`name`, and `namespace` — pure construction, no `helm install` yet.

```gherkin
Given HelmRelease known as "<NginxRelease>":
  | PROPERTY  | VALUE                 |
  | chart     | <NginxHelmChart>      |
  | name      | sandbox-nginx-release |
  | namespace | thomas-helm-test    |
```

See [Kubernetes: Deployment](KUBECTL.md#deployment) for discovering the
real `Deployment`/`Service`/`Pod` a `HelmRelease` creates once installed.

### Manage a HelmRelease

```gherkin
When I {install|upgrade|uninstall|rollback|status|history|test} HelmRelease known as "<Alias>" with:
```

Only `install`/`upgrade` take a chart ref; the rest only ever take
`RELEASE_NAME -n NAMESPACE`.

!!! note "`helm install` is genuinely not idempotent"
    A second install of the same release name errors
    (`cannot re-use a name that is still in use`) — that's real, correct
    Helm behavior, not a framework limitation. The rerun-safe idiom used
    throughout this suite is `upgrade` with `--install`/`--atomic` set
    (see the "Rerun-safe install" tab below).

`--atomic` blocks until the rollout is healthy (or rolls back on
failure) — this is why [Kubernetes](KUBECTL.md) discovery right after an
`--atomic` upgrade never needs to poll.

=== "Rerun-safe install"

    ```gherkin
    When I upgrade HelmRelease known as "<NginxRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
    Then the command exited with 0
    ```

=== "Rolling back"

    ```gherkin
    When I upgrade HelmRelease known as "<RollbackRelease>" with:
      | OPTION | VALUE          |
      | --set  | replicaCount=2 |
    Then the command exited with 0
    When I rollback HelmRelease known as "<RollbackRelease>" with:
      | OPTION | VALUE |
      |        | 1     |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                  |
      | STDOUT | contains  | Rollback was a success |
    ```

    (`features/helm/release.feature`)

### Get HelmRelease Info

```gherkin
When I get {all|hooks|manifest|metadata|notes|values} for HelmRelease known as "<Alias>" with:
```

Runs `helm get <sub> <name> -n <namespace>`.

```gherkin
When I get values for HelmRelease known as "<NginxRelease>" with:
  | OPTION | VALUE |
  | -a     | True  |
  | -o     | yaml  |
Then the command result data has:
  | KEY          | CONDITION | VALUE |
  | replicaCount | equals    | 1     |
```

### List HelmReleases

```gherkin
When I list HelmRelease with:
```

Runs `helm list` (no alias — lists releases matching the given options).

```gherkin
When I list HelmRelease with:
  | OPTION | VALUE              |
  | -n     | thomas-helm-test |
  | -o     | yaml               |
Then the command result data has:
  | KEY      | CONDITION | VALUE                 |
  | [*].name | equals    | sandbox-nginx-release |
```

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
