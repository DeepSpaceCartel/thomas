# Resources

Four resource types exist purely to be *constructed* and then referenced
by other objects — none of them have real commands of their own except
`Directory`, whose real commands (index/lint/package/dependency
management, plus purging its contents) are documented alongside it here.
See [BDD conventions](../concepts/bdd-conventions.md#resource-substitution)
for how `<Resource>` substitution works in general — the same `<...>`
mechanism also resolves `Helm Release`/`HTTP Endpoint`/`HTTPS Endpoint`
references to real objects, not just these four.

## Directory

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

Registers a local filesystem path, checked to really exist at
construction time. `Directory` has exactly one real field (`path`), so
the oneline form covers every real construction; the table form still
exists underneath, and is what `-full.feature` files use throughout —
`-short.feature` files instead reach for a real [Payload
accumulator](../concepts/bdd-conventions.md#construction) for the
negative-path tests that need an unknown/missing field:

=== "Short"

    ```gherkin
    Given "<BadDirectoryPayload>" field "xxx" is "./charts"
    When I attempt to define Directory known as "<BadDirectory>" using "<BadDirectoryPayload>"
    Then it should have failed with 'Directory has no field "xxx"'
    ```

=== "Full"

    ```gherkin
    When I attempt to define Directory known as "<BadDirectory>":
      | PROPERTY | VALUE    |
      | xxx      | ./charts |
    Then it should have failed with 'Directory has no field "xxx"'
    ```

**Referenced by a Helm Chart**:
```gherkin
Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
```
See [Helm: Index/Lint/Package/Manage Dependencies](HELM.md#directory)
for the real `helm`-backed commands this resource feeds — this page
only covers construction and the one command below that isn't a
`helm` invocation.

### Purge a Directory

```gherkin
When I purge Directory known as "<Resource>"
```

Empties the directory's contents on disk (except `.gitkeep`). A pure
filesystem operation, no `helm` invocation — used to restore a genuine
"nothing downloaded yet" precondition before a dependency scenario.

```gherkin
When I purge Directory known as "<DownloadsDirectory>"
```

## File

=== "Short"

    ```gherkin
    Given File "<NginxChartFile>" at "./charts/test-nginx-0.1.0.tgz"
    ```

=== "Full"

    ```gherkin
    Given File known as "<NginxChartFile>":
      | PROPERTY | VALUE                          |
      | path     | ./charts/test-nginx-0.1.0.tgz  |
    ```

A local file path, checked to really exist at construction time —
typically a packaged chart archive (`.tgz`) used as a Chart's
`local-archive` source. `File` has exactly one real field (`path`); the
table form is what `-full.feature` stays with throughout, and the
negative-path tests use the same [Payload
accumulator](../concepts/bdd-conventions.md#construction) shape as
`Directory` above:

=== "Short"

    ```gherkin
    Given "<BadFilePayload>" field "xxx" is "./charts/test-nginx-0.1.0.tgz"
    When I attempt to define File known as "<BadFile>" using "<BadFilePayload>"
    Then it should have failed with 'File has no field "xxx"'
    ```

=== "Full"

    ```gherkin
    When I attempt to define File known as "<BadFile>":
      | PROPERTY | VALUE                          |
      | xxx      | ./charts/test-nginx-0.1.0.tgz  |
    Then it should have failed with 'File has no field "xxx"'
    ```

**Referenced by a Helm Chart**:
```gherkin
Given File "<NginxChartFile>" at "./charts/test-nginx-0.1.0.tgz"
And Helm Chart "<LocalArchiveNginxHelmChart>" in "<NginxChartFile>"
```
A chart sourced from a local archive instead of a directory.

## URL

=== "Short"

    ```gherkin
    Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
    ```

=== "Full"

    ```gherkin
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                               |
      | value    | https://charts.bitnami.com/bitnami  |
    ```

An `http(s)://` URL, validated as well-formed at construction time. Used
as a Chart's `url` source or a Repository's `url`. `URL` has exactly one
real field (`value`); negative-path tests use the same [Payload
accumulator](../concepts/bdd-conventions.md#construction) shape:

=== "Short"

    ```gherkin
    Given "<MalformedUrlPayload>" field "value" is "not-a-url"
    When I attempt to define URL known as "<MalformedUrl>" using "<MalformedUrlPayload>"
    Then it should have failed with 'URL is not well-formed'
    ```

=== "Full"

    ```gherkin
    When I attempt to define URL known as "<MalformedUrl>":
      | PROPERTY | VALUE     |
      | value    | not-a-url |
    Then it should have failed with 'URL is not well-formed'
    ```

**Referenced by a Helm Repo**:
```gherkin
Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
And Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "<BitnamiRepoUrl>"
```
The same `URL` resource feeding a [Repository](HELM.md#repository).

## OCI Artifact

=== "Short"

    ```gherkin
    Given OCI Artifact "<NginxOciArtifact>" at "oci://registry-1.docker.io/bitnamicharts/nginx"
    ```

=== "Full"

    ```gherkin
    Given OCI Artifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                          |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx |
    ```

An OCI registry reference (`oci://...`), validated for the correct
scheme at construction time. Used as a Chart's `oci` source. `OCI
Artifact` has exactly one real field (`ref`); negative-path tests use
the same [Payload accumulator](../concepts/bdd-conventions.md#construction)
shape:

=== "Short"

    ```gherkin
    Given "<NotOciPayload>" field "ref" is "https://example.com/charts"
    When I attempt to define OCI Artifact known as "<NotOci>" using "<NotOciPayload>"
    Then it should have failed with 'OCIArtifact ref must start with "oci://"'
    ```

=== "Full"

    ```gherkin
    When I attempt to define OCI Artifact known as "<NotOci>":
      | PROPERTY | VALUE                       |
      | ref      | https://example.com/charts  |
    Then it should have failed with 'OCIArtifact ref must start with "oci://"'
    ```

**Referenced by a Helm Chart**:
```gherkin
Given OCI Artifact "<NginxOciArtifact>" at "oci://registry-1.docker.io/bitnamicharts/nginx"
And Helm Chart "<OciNginxHelmChart>" in "<NginxOciArtifact>"
```

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
