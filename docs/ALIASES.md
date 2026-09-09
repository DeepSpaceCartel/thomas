# Aliases

Four alias types exist purely to be *constructed* and then referenced by
other objects — none of them have real commands of their own. `Directory`
is the one exception with real commands (index/lint/package/dependency
management), documented alongside those commands on the
[Helm](HELM.md#directory) page; this page covers its construction shape
only. See [BDD conventions](bdd-conventions.md#alias-substitution) for
how `<Alias>` substitution works in general.

## Directory

```gherkin
Given Directory known as "<Alias>":
```

Registers a local filesystem path, checked to really exist at
construction time.

=== "Minimal"

    ```gherkin
    Given Directory known as "<ChartsDirectory>":
      | PROPERTY | VALUE    |
      | path     | ./charts |
    ```

=== "Referenced by a HelmChart"

    ```gherkin
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    ```

    See [Helm: Index/Lint/Package/Manage Dependencies](HELM.md#directory)
    for the real commands this alias feeds.

## File

```gherkin
Given File known as "<Alias>":
```

A local file path, checked to really exist at construction time —
typically a packaged chart archive (`.tgz`) used as a `HelmChart`'s
`local-archive` source.

=== "Minimal"

    ```gherkin
    Given File known as "<NginxChartFile>":
      | PROPERTY | VALUE                    |
      | path     | ./charts/nginx-0.1.0.tgz |
    ```

=== "Referenced by a HelmChart"

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

## URL

```gherkin
Given URL known as "<Alias>":
```

An `http(s)://` URL, validated as well-formed at construction time. Used
as a `HelmChart`'s `url` source or a `HelmRepo`'s `url`.

=== "Minimal"

    ```gherkin
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    ```

=== "Referenced by a HelmRepo"

    ```gherkin
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    And Helm Repo known as "<BitnamiHelmRepo>":
      | PROPERTY | VALUE            |
      | name     | bitnami          |
      | url      | <BitnamiRepoUrl> |
    ```

    The same `URL` alias feeding a [`HelmRepo`](HELM.md#helmrepo)
    (`features/helm/helm-chart.feature`).

## OCIArtifact

```gherkin
Given OCIArtifact known as "<Alias>":
```

An OCI registry reference (`oci://...`), validated for the correct
scheme at construction time. Used as a `HelmChart`'s `oci` source.

=== "Minimal"

    ```gherkin
    Given OCIArtifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                          |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx |
    ```

=== "Referenced by a HelmChart"

    ```gherkin
    Given OCIArtifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                          |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx |
    And Helm Chart known as "<OciNginxHelmChart>":
      | PROPERTY | VALUE              |
      | chart    | <NginxOciArtifact> |
    ```

    (`features/helm/helm-chart.feature`)

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
