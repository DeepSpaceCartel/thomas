# Helm

Real `helm`/`tar` invocations against real (small, public) chart
repositories and a real cluster — nothing here is mocked (the `tar`
calls genuinely list/extract files from local chart archives; see
[Aliases: File](ALIASES.md#file)). See [BDD
conventions](bdd-conventions.md) for the "define, then act" pattern and
table shapes these steps build on.

## Directory

Steps scoped to a local filesystem path: index, lint, package, and
manage dependencies.

### Define a Directory

```gherkin
Given Directory known as "<Alias>":
```

See [Aliases: Directory](ALIASES.md#directory) for the construction
shape and validation behavior. The base object every other Helm step in
this section either wraps directly (`HelmChart`) or operates on.

### Index a Directory

```gherkin
When I index Directory known as "<Alias>"
When I index Directory known as "<Alias>" with:
```

Runs `helm repo index <path>` against the directory.

```gherkin
Given Directory known as "<ChartsDirectory>":
  | PROPERTY | VALUE    |
  | path     | ./charts |
When I index Directory known as "<ChartsDirectory>"
Then the command exited with 0
```

### Lint a Directory

```gherkin
When I lint Directory known as "<Alias>"
When I lint Directory known as "<Alias>" with:
```

Runs `helm lint <path>`. Only accepts a local path — a `Directory`,
never a `HelmChart` (which can also be a URL/OCI/reference that `lint`
can't operate on).

```gherkin
Given Directory known as "<NginxChartDirectory>":
  | PROPERTY | VALUE          |
  | path     | ./charts/nginx |
When I lint Directory known as "<NginxChartDirectory>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                |
  | STDOUT | contains  | 1 chart(s) linted, 0 chart(s) failed |
```

### Package a Directory

```gherkin
When I package Directory known as "<Alias>" with:
```

Runs `helm package <path>`, same local-path-only restriction as `lint`.

```gherkin
When I package Directory known as "<NginxChartDirectory>" with:
  | OPTION        | VALUE  |
  | --destination | .cache |
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
When I {build|list|update} dependencies for Directory known as "<Alias>"
When I {build|list|update} dependencies for Directory known as "<Alias>" with:
```

Runs `helm dependency build|list|update <path>` against a chart
directory declaring real dependencies.

```gherkin
When I list dependencies for Directory known as "<DependencyChartDirectory>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE   |
  | STDOUT | contains  | missing |
When I update dependencies for Directory known as "<DependencyChartDirectory>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE           |
  | STDOUT | contains  | Saving 1 charts |
```

Exercised against `charts/test-dependency/`, a fixture that exists
solely to declare a real dependency.

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
alias — see [Aliases](ALIASES.md) for how each of those four is itself
constructed. All five source kinds, each pulled from a real scenario in
`features/helm/helm-chart.feature`:

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
When I show {chart|values|readme|crds|all} for Helm Chart known as "<Alias>"
When I show {chart|values|readme|crds|all} for Helm Chart known as "<Alias>" with:
```

Runs `helm show <sub> [CHART]`. `chart`/`values`/`crds` output YAML
(assert with `the command result data has:`); `readme` is plain
markdown and `all` has no `-o` flag at all — both use the raw-text `the
command exited with {int}:` form instead.

```gherkin
When I show values for Helm Chart known as "<LocalNginxHelmChart>"
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

=== "Then referenced by name from a HelmChart"

    ```gherkin
    When I add Helm Repo known as "<BitnamiHelmRepo>"
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
When I add Helm Repo known as "<Alias>"
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
When I remove Helm Repo known as "<Alias>"
When I remove Helm Repo known as "<Alias>" with:
```

Runs `helm repo remove <name>`.

```gherkin
When I remove Helm Repo known as "<SandboxRemoveExampleRepo>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                    |
  | STDOUT | contains  | has been removed from your repositories |
```

### Update a HelmRepo

```gherkin
When I update Helm Repo known as "<Alias>"
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
When I list Helm Repo
When I list Helm Repo with:
```

Runs `helm repo list` (no alias — lists every registered repo).

```gherkin
When I list Helm Repo with:
  | OPTION   | VALUE |
  | --output | yaml  |
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
When I {install|upgrade|uninstall|rollback|status|history|test} HelmRelease known as "<Alias>"
When I {install|upgrade|uninstall|rollback|status|history|test} HelmRelease known as "<Alias>" with:
```

Only `install`/`upgrade` take a chart ref; the rest only ever take
`RELEASE_NAME -n NAMESPACE`.

!!! note "`helm install` is genuinely not idempotent"
    A second install of the same release name errors
    (`cannot re-use a name that is still in use`) — that's real, correct
    Helm behavior, not a framework limitation. The rerun-safe idiom used
    throughout this suite is `upgrade` with `--install`/`--atomic` set
    (see the "upgrade" tab below).

`--atomic` blocks until the rollout is healthy (or rolls back on
failure) — this is why [Kubernetes](KUBECTL.md) discovery right after an
`--atomic` upgrade never needs to poll. Every example below is pulled
verbatim from `features/helm/release.feature`, all against the same
`<NginxRelease>` unless noted:

=== "install"

    ```gherkin
    When I install HelmRelease known as "<DuplicateRelease>" with:
      | OPTION             | VALUE |
      | --create-namespace | True  |
    Then the command exited with 0
    ```

    A second `install` of the same name is the one place this suite
    deliberately exercises the non-idempotency above:
    ```gherkin
    When I install HelmRelease known as "<DuplicateRelease>"
    Then the command exited with 1:
      | SOURCE | CONDITION | VALUE                |
      | STDERR | contains  | cannot re-use a name |
    ```

=== "upgrade"

    ```gherkin
    When I upgrade HelmRelease known as "<NginxRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0
    ```

=== "status"

    ```gherkin
    When I status HelmRelease known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY         | CONDITION | VALUE    |
      | info.status | equals    | deployed |
    ```

=== "history"

    ```gherkin
    When I history HelmRelease known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY        | CONDITION | VALUE    |
      | [*].status | equals    | deployed |
    ```

=== "test"

    ```gherkin
    When I test HelmRelease known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE     |
      | STDOUT | contains  | Succeeded |
    ```

=== "rollback"

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

=== "uninstall"

    ```gherkin
    When I uninstall HelmRelease known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE       |
      | STDOUT | contains  | uninstalled |
    ```

### Get HelmRelease Info

```gherkin
When I get {all|hooks|manifest|metadata|notes|values} for HelmRelease known as "<Alias>"
When I get {all|hooks|manifest|metadata|notes|values} for HelmRelease known as "<Alias>" with:
```

Runs `helm get <sub> <name> -n <namespace>`. `values`/`metadata` output
YAML (assert with `the command result data has:`); the rest use the
raw-text `the command exited with {int}:` form. Every example below is
pulled verbatim from `features/helm/release.feature`, against the same
`<NginxRelease>`:

=== "values"

    ```gherkin
    When I get values for HelmRelease known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --all    | True  |
      | --output | yaml  |
    Then the command result data has:
      | KEY          | CONDITION | VALUE |
      | replicaCount | equals    | 1     |
    ```

=== "metadata"

    ```gherkin
    When I get metadata for HelmRelease known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY   | CONDITION | VALUE                 |
      | name  | equals    | sandbox-nginx-release |
      | chart | equals    | nginx                 |
    ```

=== "hooks"

    ```gherkin
    When I get hooks for HelmRelease known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE               |
      | STDOUT | contains  | helm.sh/hook": test |
    ```

=== "manifest"

    ```gherkin
    When I get manifest for HelmRelease known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                  |
      | STDOUT | contains  | # Source: nginx/templates/service.yaml |
    ```

=== "notes"

    ```gherkin
    When I get notes for HelmRelease known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE      |
      | STDOUT | contains  | Access it: |
    ```

=== "all"

    ```gherkin
    When I get all for HelmRelease known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                  |
      | STDOUT | contains  | NOTES:                                 |
      | STDOUT | contains  | # Source: nginx/templates/service.yaml |
    ```

### List HelmReleases

```gherkin
When I list HelmRelease
When I list HelmRelease with:
```

Runs `helm list` (no alias — lists releases matching the given options).

```gherkin
When I list HelmRelease with:
  | OPTION      | VALUE            |
  | --namespace | thomas-helm-test |
  | --output    | yaml             |
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
