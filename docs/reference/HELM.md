# Helm

Real `helm`/`tar` invocations against real (small, public) chart
repositories and a real cluster — nothing here is mocked (the `tar`
calls genuinely list/extract files from local chart archives; see
[Resources: File](RESOURCES.md#file)). See [BDD
conventions](../concepts/bdd-conventions.md) for the "define, then act"
pattern and table shapes these steps build on.

## Directory

Steps scoped to a local filesystem path: index, lint, package, and
manage dependencies.

### Define a Directory

=== "Short"

    ```gherkin
    Given Directory "<ChartsDirectory>" at "./charts"
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<ChartsDirectory>":
      | PROPERTY | VALUE    |
      | path     | ./charts |
    ```

See [Resources: Directory](RESOURCES.md#directory) for the construction
shape, validation behavior, negative-path forms, and how to purge one.
The base object every other Helm step in this section either wraps
directly (a Chart) or operates on.

### Index a Directory

```gherkin
When I index Directory known as "<Resource>"
When I index Directory known as "<Resource>" with:
When I index Directory "<Resource>" with {flags}
```

Runs `helm repo index <path>` against the directory.

=== "Short"

    ```gherkin
    Given Directory "<ChartsDirectory>" at "./charts"
    When I index Directory "<ChartsDirectory>" with --json
    Then the command exited with 0
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<ChartsDirectory>":
      | PROPERTY | VALUE   |
      | path     | ./charts |
    When I index Directory known as "<ChartsDirectory>" with:
      | OPTION | VALUE |
      | --json | True  |
    Then the command exited with 0
    ```

No flags to pass at all is the bare, table-less form — identical in
both `-short.feature` and `-full.feature` (nothing to shorten):
```gherkin
When I index Directory known as "<ChartsDirectory>"
Then the command exited with 0
```

### Lint a Directory

```gherkin
When I lint Directory known as "<Resource>"
When I lint Directory known as "<Resource>" with:
When I lint Directory "<Resource>" with {flags}
```

Runs `helm lint <path>`. Only accepts a local path — a `Directory`,
never a Chart (which can also be a URL/OCI/reference that `lint` can't
operate on).

=== "Short"

    ```gherkin
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    When I lint Directory "<NginxChartDirectory>" with --strict
    Then the command exited with 0 STDOUT contains "1 chart(s) linted, 0 chart(s) failed"
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    When I lint Directory known as "<NginxChartDirectory>" with:
      | OPTION   | VALUE |
      | --strict | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                |
      | STDOUT | contains  | 1 chart(s) linted, 0 chart(s) failed |
    ```

### Package a Directory

```gherkin
When I package Directory known as "<Resource>" with:
When I package Directory "<Resource>" with {flags}
```

Runs `helm package <path>`, same local-path-only restriction as `lint`.

=== "Short"

    ```gherkin
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    When I package Directory "<NginxChartDirectory>" with --destination .cache
    Then the command exited with 0 STDOUT contains "Successfully packaged chart"
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    When I package Directory known as "<NginxChartDirectory>" with:
      | OPTION        | VALUE  |
      | --destination | .cache |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                       |
      | STDOUT | contains  | Successfully packaged chart |
    ```

### Manage Directory Dependencies

```gherkin
When I {build|list|update} dependencies for Directory known as "<Resource>"
When I {build|list|update} dependencies for Directory known as "<Resource>" with:
When I {build|list|update} dependencies for Directory "<Resource>" with {flags}
```

Runs `helm dependency build|list|update <path>` against a chart
directory declaring real dependencies.

=== "Short"

    ```gherkin
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    When I list dependencies for Directory "<NginxChartDirectory>" with --max-col-width 200
    Then the command exited with 0 STDOUT contains "no dependencies at"
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    When I list dependencies for Directory known as "<NginxChartDirectory>" with:
      | OPTION          | VALUE |
      | --max-col-width | 200   |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE              |
      | STDOUT | contains  | no dependencies at |
    ```

Exercised against `charts/test-dependency/` (a fixture that exists
solely to declare a real dependency) for the build/update forms:

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

## Chart

Steps scoped to a chart reference: define it from any of five real
sources, assert on its `Chart.yaml`, template it, or inspect it with
`helm show`.

### Define a Chart

=== "Short"

    ```gherkin
    Given Helm Chart "<RepoReferenceNginxHelmChart>" in "nginx" repo "<BitnamiRepoUrl>" version "25.1.10"
    ```

=== "Full"

    ```gherkin
    Given Helm Chart known as "<RepoReferenceNginxHelmChart>":
      | PROPERTY | VALUE            |
      | chart    | nginx            |
      | repo     | <BitnamiRepoUrl> |
      | version  | 25.1.10          |
    ```

Registers a chart reference — a local directory, a local archive, a
URL, an OCI artifact, or a `repo/name` reference (optionally built from
a bare name plus a separate `repo` field). The `source`/`repo` fields
accept either a literal value or a `<Directory>`/`<File>`/`<URL>`/`<OCI
Artifact>` resource — see [Resources](RESOURCES.md) for how each of
those four is itself constructed. All five source kinds, each pulled
from a real scenario:

=== "Local Directory"

    ```gherkin
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    ```

=== "Local Archive"

    ```gherkin
    Given File "<NginxChartFile>" at "./charts/test-nginx-0.1.0.tgz"
    And Helm Chart "<LocalArchiveNginxHelmChart>" in "<NginxChartFile>"
    ```

=== "URL"

    ```gherkin
    Given URL "<NginxChartUrl>" at "https://charts.bitnami.com/bitnami/nginx-18.2.5.tgz"
    And Helm Chart "<UrlNginxHelmChart>" in "<NginxChartUrl>"
    ```

=== "Reference"

    ```gherkin
    Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
    And Helm Chart "<RepoReferenceNginxHelmChart>" in "nginx" repo "<BitnamiRepoUrl>" version "25.1.10"
    ```

    `version` is optional and only valid for this "reference" source kind
    (`chart`+`repo`, or a bare `repo/name`) — a local path/URL/OCI ref is
    already pinned by what it points at, and setting `version` on one of
    those fails loudly rather than being silently ignored.

=== "OCI"

    ```gherkin
    Given OCI Artifact "<NginxOciArtifact>" at "oci://registry-1.docker.io/bitnamicharts/nginx"
    And Helm Chart "<OciNginxHelmChart>" in "<NginxOciArtifact>"
    ```

### Assert on a Chart's Chart.yaml

```gherkin
Given Helm Chart known as "<Resource>" has:
Given Helm Chart "<Resource>" has {string} {condition} {word}    # oneline sibling, one condition at a time
```

Asserts against the chart's real, parsed `Chart.yaml` — `KEY|CONDITION|VALUE`.
The oneline form takes a quoted value instead of `{word}` for one
containing a space, and drops the value entirely for `exists`/
`undefined` (the only two conditions that ignore it):

=== "Short"

    ```gherkin
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Chart "<LocalNginxHelmChart>" has "apiVersion" is v2
    And Helm Chart "<LocalNginxHelmChart>" has "name" is test-nginx
    And Helm Chart "<LocalNginxHelmChart>" has "type" undefined
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Chart known as "<LocalNginxHelmChart>" has:
      | KEY        | CONDITION | VALUE      |
      | apiVersion | equals    | v2         |
      | name       | equals    | test-nginx |
      | type       | undefined |            |
    ```

### Template a Chart

```gherkin
When I template Helm Chart known as "<Resource>" with:
When I template Helm Chart "<Resource>" with {flags}
```

Runs `helm template [NAME] [CHART]`. Any table-supplied positional arg
(a blank-`OPTION` row, or a bare token in the `{flags}` form) must come
*before* the chart args — the wrong order gets the chart's own path
parsed as a stray extra arg.

=== "Short"

    ```gherkin
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I template Helm Chart "<LocalNginxHelmChart>" with test-nginx
    Then the command exited with 0 STDOUT contains "# Source: test-nginx/templates/service.yaml"
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I template Helm Chart known as "<LocalNginxHelmChart>" with:
      | OPTION | VALUE      |
      |        | test-nginx |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                       |
      | STDOUT | contains  | # Source: test-nginx/templates/service.yaml |
    ```

### Show Chart Info

```gherkin
When I show {chart|values|readme|crds|all} for Helm Chart known as "<Resource>"
When I show {chart|values|readme|crds|all} for Helm Chart known as "<Resource>" with:
When I show {chart|values|readme|crds|all} for Helm Chart "<Resource>" with {flags}
```

Runs `helm show <sub> [CHART]`. `chart`/`values`/`crds` output YAML
(assert with `the command result data has:`); `readme` is plain
markdown and `all` has no `-o` flag at all — both use the raw-text `the
command exited with {int}:` form instead.

=== "Short"

    ```gherkin
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I show crds for Helm Chart "<LocalNginxHelmChart>" with --devel
    Then the command exited with 0
    ```

=== "Full"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I show crds for Helm Chart known as "<LocalNginxHelmChart>" with:
      | OPTION  | VALUE |
      | --devel | True  |
    Then the command exited with 0
    ```

The table-less form (nothing to shorten) covers the common `values`/
`chart` case:
```gherkin
When I show values for Helm Chart known as "<LocalNginxHelmChart>"
Then the command result data has:
  | KEY          | CONDITION | VALUE |
  | replicaCount | equals    | 1     |
```

## Repository

Steps scoped to a chart repository: define it, then add/remove/update/list
it via `helm repo`.

### Define a Repository

=== "Short"

    ```gherkin
    Given Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "<BitnamiRepoUrl>"
    ```

=== "Full"

    ```gherkin
    Given Helm Repo known as "<BitnamiHelmRepo>":
      | PROPERTY | VALUE            |
      | name     | bitnami          |
      | url      | <BitnamiRepoUrl> |
    ```

Registers a repository's real `name`/`url` — pure construction, no
`helm repo add` yet.

=== "Basic"

    ```gherkin
    Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
    And Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "<BitnamiRepoUrl>"
    ```

=== "Then referenced by name from a Chart"

    ```gherkin
    When I add Helm Repo known as "<BitnamiHelmRepo>"
    And Helm Chart "<ReferenceNginxHelmChart>" in "bitnami/nginx"
    ```

    Registering the repo for real, then referencing it by its registered
    `name/chart` string from a Chart — the alternative to the
    bare-name-plus-`repo`-field form shown in the "Reference" tab above.

### Add a Repository

```gherkin
When I add Helm Repo known as "<Resource>"
When I add Helm Repo known as "<Resource>" with:
When I add Helm Repo "<Resource>" with {flags}
```

Runs `helm repo add <name> <url>`.

=== "Short"

    ```gherkin
    Given URL "<MetricsServerRepoUrl>" at "https://kubernetes-sigs.github.io/metrics-server/"
    And Helm Repo "<ThomasAddExampleRepo>" named "thomas-add-example" at "<MetricsServerRepoUrl>"
    When I add Helm Repo "<ThomasAddExampleRepo>" with --insecure-skip-tls-verify
    Then the command exited with 0 STDOUT contains "has been added to your repositories"
    ```

=== "Full"

    ```gherkin
    Given URL known as "<MetricsServerRepoUrl>":
      | PROPERTY | VALUE                                             |
      | value    | https://kubernetes-sigs.github.io/metrics-server/ |
    And Helm Repo known as "<ThomasAddExampleRepo>":
      | PROPERTY | VALUE                   |
      | name     | thomas-add-example      |
      | url      | <MetricsServerRepoUrl> |
    When I add Helm Repo known as "<ThomasAddExampleRepo>" with:
      | OPTION                     | VALUE |
      | --insecure-skip-tls-verify | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                |
      | STDOUT | contains  | has been added to your repositories  |
    ```

### Remove a Repository

```gherkin
When I remove Helm Repo known as "<Resource>"
When I remove Helm Repo known as "<Resource>" with:
When I remove Helm Repo "<Resource>" with {flags}
```

Runs `helm repo remove <name>`.

=== "Short"

    ```gherkin
    When I remove Helm Repo "<ThomasRemoveExampleRepo>" with --debug
    Then the command exited with 0 STDOUT contains "has been removed from your repositories"
    ```

=== "Full"

    ```gherkin
    When I remove Helm Repo known as "<ThomasRemoveExampleRepo>" with:
      | OPTION  | VALUE |
      | --debug | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                    |
      | STDOUT | contains  | has been removed from your repositories |
    ```

### Update a Repository

```gherkin
When I update Helm Repo known as "<Resource>"
When I update Helm Repo known as "<Resource>" with:
When I update Helm Repo "<Resource>" with {flags}
```

Runs `helm repo update <name>`.

=== "Short"

    ```gherkin
    When I update Helm Repo "<MetricsServerHelmRepo>" with --fail-on-repo-update-fail
    Then the command exited with 0
    ```

=== "Full"

    ```gherkin
    When I update Helm Repo known as "<MetricsServerHelmRepo>" with:
      | OPTION                     | VALUE |
      | --fail-on-repo-update-fail | True  |
    Then the command exited with 0
    ```

### List Repositories

```gherkin
When I list Helm Repo
When I list Helm Repo with:
When I list Helm Repo with {flags}
```

Runs `helm repo list` (no resource — lists every registered repo).

=== "Short"

    ```gherkin
    When I list Helm Repo with --output yaml
    Then the command result has "[*].name" is bitnami
    ```

=== "Full"

    ```gherkin
    When I list Helm Repo with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY      | CONDITION | VALUE   |
      | [*].name | equals    | bitnami |
    ```

## Release

Steps scoped to a Helm release: define it, then install/upgrade/roll
back/inspect/list it.

### Define a Release

=== "Short"

    ```gherkin
    Given Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "thomas-nginx-release" in "thomas-helm-test"
    ```

=== "Full"

    ```gherkin
    Given Helm Release known as "<NginxRelease>":
      | PROPERTY  | VALUE                |
      | chart     | <NginxHelmChart>     |
      | name      | thomas-nginx-release |
      | namespace | thomas-helm-test     |
    ```

Registers a release's `chart` (resolved to the real Chart object),
`name`, and `namespace` — pure construction, no `helm install` yet.

See [Kubernetes: Deployment](KUBECTL.md#deployment) for discovering the
real `Deployment`/`Service`/`Pod` a Release creates once installed.

### Manage a Release

```gherkin
When I {install|upgrade|uninstall|rollback|status|history|test} Helm Release known as "<Resource>"
When I {install|upgrade|uninstall|rollback|status|history|test} Helm Release known as "<Resource>" with:
When I {install|upgrade|uninstall|rollback|status|history|test} Helm Release "<Resource>" with <flags>
When I get status of Helm Release "<Resource>" as JSON|YAML
```

Only `install`/`upgrade` take a chart ref; the rest only ever take
`RELEASE_NAME -n NAMESPACE`. The last form is a shorthand specifically
for `--output json`/`--output yaml` — by far the most common real flags
payload — alongside the general `with <flags>` short form for anything
else.

!!! note "`helm install` is genuinely not idempotent"
    A second install of the same release name errors
    (`cannot re-use a name that is still in use`) — that's real, correct
    Helm behavior, not a framework limitation. The rerun-safe idiom used
    throughout this suite is `upgrade` with `--install`/`--atomic` set
    (see the "upgrade" tab below).

`--atomic` blocks until the rollout is healthy (or rolls back on
failure) — this is why [Kubernetes](KUBECTL.md) discovery right after an
`--atomic` upgrade never needs to poll. `the command succeeds` (short
form only) is a plain-English alias for `the command exited with 0`
specifically — `the command exited with {int}` is still the form for a
real nonzero-exit assertion. `Then Helm Release "<X>" is "<status>"` is
a fixed-key shorthand for `info.status equals <status>` against the
`helm status` result right above it — still just reading the captured
command output, plus a real check that `"<X>"` is a genuinely
registered Release first.

=== "Short"

    ```gherkin
    When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
    Then the command succeeds

    When I get status of Helm Release "<NginxRelease>" as YAML
    Then Helm Release "<NginxRelease>" is "deployed"

    When I get history of Helm Release "<NginxRelease>" as YAML
    Then the command result has "[*].status" is deployed

    When I test Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains Succeeded

    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains uninstalled
    ```

    Rollback, and the one deliberate non-idempotent `install` (a second
    `install` of the same release name), each in their own scenario:
    ```gherkin
    When I upgrade Helm Release "<RollbackRelease>" with --set replicaCount=2
    Then the command exited with 0
    When I rollback Helm Release "<RollbackRelease>" with 1
    Then the command exited with 0 STDOUT contains "Rollback was a success"
    ```
    ```gherkin
    When I install Helm Release "<DuplicateRelease>" with --create-namespace
    Then the command exited with 0
    When I install Helm Release known as "<DuplicateRelease>"
    Then the command exited with 1 STDERR contains "cannot re-use a name"
    ```

=== "Full"

    ```gherkin
    When I upgrade Helm Release known as "<NginxRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    When I status Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY         | CONDITION | VALUE    |
      | info.status | equals    | deployed |

    When I history Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY        | CONDITION | VALUE    |
      | [*].status | equals    | deployed |

    When I test Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE     |
      | STDOUT | contains  | Succeeded |

    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE       |
      | STDOUT | contains  | uninstalled |
    ```

    Rollback, and the one deliberate non-idempotent `install`, each in
    their own scenario:
    ```gherkin
    When I upgrade Helm Release known as "<RollbackRelease>" with:
      | OPTION | VALUE          |
      | --set  | replicaCount=2 |
    Then the command exited with 0
    When I rollback Helm Release known as "<RollbackRelease>" with:
      | OPTION | VALUE |
      |        | 1     |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                  |
      | STDOUT | contains  | Rollback was a success |
    ```
    ```gherkin
    When I install Helm Release known as "<DuplicateRelease>" with:
      | OPTION             | VALUE |
      | --create-namespace | True  |
    Then the command exited with 0
    When I install Helm Release known as "<DuplicateRelease>"
    Then the command exited with 1:
      | SOURCE | CONDITION | VALUE                |
      | STDERR | contains  | cannot re-use a name |
    ```

### Get Release Info

```gherkin
When I get {all|hooks|manifest|metadata|notes|values} for Helm Release known as "<Resource>"
When I get {all|hooks|manifest|metadata|notes|values} for Helm Release known as "<Resource>" with:
```

Runs `helm get <sub> <name> -n <namespace>`. `values`/`metadata` output
YAML (assert with `the command result data has:`); the rest use the
raw-text `the command exited with {int}:` form. `hooks`/`manifest`/
`notes`/`all` take no real flags in this suite, so their table-less
form is identical in both syntaxes (nothing to shorten).

=== "Short"

    ```gherkin
    When I get values for Helm Release "<NginxRelease>" with --all --output yaml
    Then the command result has "replicaCount" is 1

    When I get metadata for Helm Release "<NginxRelease>" as YAML
    Then the command result has "name" is thomas-nginx-release
    Then the command result has "chart" is test-nginx

    When I get hooks for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains "helm.sh/hook\": test"

    When I get manifest for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains "# Source: test-nginx/templates/service.yaml"

    When I get notes for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains "Access it:"

    When I get all for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains NOTES:
    Then the command exited with 0 STDOUT contains "# Source: test-nginx/templates/service.yaml"
    ```

=== "Full"

    ```gherkin
    When I get values for Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --all    | True  |
      | --output | yaml  |
    Then the command result data has:
      | KEY          | CONDITION | VALUE |
      | replicaCount | equals    | 1     |

    When I get metadata for Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY   | CONDITION | VALUE                 |
      | name  | equals    | thomas-nginx-release |
      | chart | equals    | test-nginx            |

    When I get hooks for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE               |
      | STDOUT | contains  | helm.sh/hook": test |

    When I get manifest for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                  |
      | STDOUT | contains  | # Source: test-nginx/templates/service.yaml |

    When I get notes for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE      |
      | STDOUT | contains  | Access it: |

    When I get all for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                  |
      | STDOUT | contains  | NOTES:                                 |
      | STDOUT | contains  | # Source: test-nginx/templates/service.yaml |
    ```

### List Releases

```gherkin
When I list Helm Release
When I list Helm Release with:
When I list Helm Release with {flags}
```

Runs `helm list` (no resource — lists releases matching the given options).

=== "Short"

    ```gherkin
    When I list Helm Release with --namespace thomas-helm-test --output yaml
    Then the command result has "[*].name" is thomas-nginx-release
    ```

=== "Full"

    ```gherkin
    When I list Helm Release with:
      | OPTION      | VALUE            |
      | --namespace | thomas-helm-test |
      | --output    | yaml             |
    Then the command result data has:
      | KEY      | CONDITION | VALUE                 |
      | [*].name | equals    | thomas-nginx-release |
    ```

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
