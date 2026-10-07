# Docker

Real `docker buildx` invocations against a real remote BuildKit endpoint
— nothing here is mocked. A build genuinely runs on that endpoint and a
push genuinely lands in a real registry. See [BDD
conventions](../concepts/bdd-conventions.md) for the "define, then act"
pattern these steps build on, and [Resources](RESOURCES.md) for the
`Directory`/`File` construction this domain reuses (a build context is
just a `Directory`, and registry credentials are just a `File`).

## Docker Buildx Builder

=== "Short"

    ```gherkin
    Given Docker Buildx Builder "<RemoteBuilder>" named "my-builder" at "tcp://buildkit.example.com:1234"
    ```

=== "Full"

    ```gherkin
    Given Docker Buildx Builder known as "<RemoteBuilder>":
      | PROPERTY | VALUE                          |
      | name     | my-builder                     |
      | endpoint | tcp://buildkit.example.com:1234 |
    ```

Registers a remote BuildKit endpoint. No live check at construction —
same reasoning as [`RestEndpoint`](REST.md): there's no cheap read-only
probe for "is a remote buildkitd reachable" that isn't itself the real
action (`create`) this object exists to perform. `endpoint` may be
written as a `<Resource>` alias instead of a literal, same as any other
Helm/Docker field.

Negative-path tests (unknown field, missing `name`/`endpoint`, an
unregistered `<Resource>` alias) follow the same shape as every other
alias type — see `features/docker/docker-buildx-builder-validation-{short,full}.feature`.

### Create / remove a Docker Buildx Builder

```gherkin
When I create Docker Buildx Builder known as "<Resource>"
When I create Docker Buildx Builder known as "<Resource>" with:
When I create Docker Buildx Builder "<Resource>" with {flags}

When I remove Docker Buildx Builder known as "<Resource>"
When I remove Docker Buildx Builder known as "<Resource>" with:
When I remove Docker Buildx Builder "<Resource>" with {flags}
```

`create` runs `docker buildx create --name <name> --driver remote
<endpoint> ...args`; `remove` runs `docker buildx rm <name>` — the
cleanup half, mirroring Helm's install/uninstall pair. Every scenario
that creates a builder removes it again, reachable from the `.feature`
file itself (Thomas's usual per-scenario cleanup discipline) — this
domain doesn't do idempotent reuse across scenarios the way a
production caller might; that kind of reuse is a `.feature`-file-level
Background concern, not something the domain itself special-cases.

=== "Short"

    ```gherkin
    Given Docker Buildx Builder "<RemoteBuilder>" named "my-builder" at "tcp://buildkit.example.com:1234"
    When I create Docker Buildx Builder known as "<RemoteBuilder>"
    Then the command exited with 0
    When I remove Docker Buildx Builder known as "<RemoteBuilder>"
    Then the command exited with 0
    ```

=== "Full"

    ```gherkin
    Given Docker Buildx Builder known as "<RemoteBuilder>":
      | PROPERTY | VALUE                          |
      | name     | my-builder                     |
      | endpoint | tcp://buildkit.example.com:1234 |
    When I create Docker Buildx Builder known as "<RemoteBuilder>"
    Then the command exited with 0
    When I remove Docker Buildx Builder known as "<RemoteBuilder>"
    Then the command exited with 0
    ```

### Build and push an image

```gherkin
When I build and push "<image-ref>" from "<build-context>" using Docker Buildx Builder known as "<Resource>" with:
When I build and push "<image-ref>" from "<build-context>" using Docker Buildx Builder known as "<Resource>" with {flags}
```

Runs `docker buildx build --builder <name> -t <image-ref> --push
<build-context> ...args`. `<image-ref>` is a literal image reference.
`<build-context>` may be a literal path or a `<Resource>` alias
(`Directory`, same as any Helm chart source) resolved the same way
every other alias field resolves.

One `OPTION|VALUE` row has a documented, named-exception meaning (same
category as `HelmRelease.chart`/`RestEndpoint.service`): `--registry-credentials
<FileAlias>` is never passed to `docker` argv literally. It's
intercepted, resolved to a real docker-config-JSON `File`, and turned
into a scoped `DOCKER_CONFIG` directory instead — a real environment
difference no CLI flag can express (a real `docker buildx build`
credential is read from `$DOCKER_CONFIG/config.json`, not a flag). The
ambient `buildx/` state is copied into the scratch directory first, so
the already-created builder stays visible under the scoped config too.

=== "Short"

    ```gherkin
    When I build and push "registry.example.com/app:v1" from "./app" using Docker Buildx Builder known as "<RemoteBuilder>" with --platform linux/amd64
    Then the command exited with 0
    ```

=== "Full"

    ```gherkin
    When I build and push "registry.example.com/app:v1" from "./app" using Docker Buildx Builder known as "<RemoteBuilder>" with:
      | OPTION     | VALUE          |
      | --platform | linux/amd64    |
    Then the command exited with 0
    ```

**With scoped registry credentials**:
```gherkin
Given File known as "<DockerConfig>":
  | PROPERTY | VALUE                    |
  | path     | ./fixtures/config.json   |
When I build and push "registry.example.com/app:v1" from "./app" using Docker Buildx Builder known as "<RemoteBuilder>" with:
  | OPTION                  | VALUE            |
  | --registry-credentials  | <DockerConfig>   |
```

## Assertions

Every action above sets `lastCommandResult` the same way every other
domain does — reuse `common.step.ts`'s exit-code/output/JMESPath
assertions (`Then the command exited with {int}`, `Then the command
result data has:`, etc.). No new `Then` vocabulary exists or is needed
for this domain.

## Real fixtures for dogfooding this domain

`features/docker/docker-buildx-builder-{short,full}.feature` deploy a
real, disposable registry (`charts/test-registry`) and a real,
disposable BuildKit instance (the `buildkit-service` chart, configured
via `fixtures/docker/buildkitd.toml` to trust that registry as plain
HTTP) into `thomas-helm-test`, then build and push a real image
(`fixtures/docker/Dockerfile`) end to end.

**PodSecurity**: a real BuildKit pod needs privileged (or
rootless-but-unconfined) execution, which the cluster's default
`baseline` PodSecurity level blocks. Each scenario labels
`thomas-helm-test` `pod-security.kubernetes.io/enforce=privileged`
([`I label namespace`](KUBECTL.md)) right before installing BuildKit,
and removes the label again right after uninstalling it — so a
recreated namespace needs no manual setup, and it only stays privileged
for as long as BuildKit runs (unless a scenario fails mid-way, in which
case the label is left behind until the next successful run). Labeling
a namespace needs cluster-scoped access CI's `ServiceAccount` doesn't
have, so both features are tagged `@requires-broad-rbac` and skipped in
CI — see [CI](../project/ci.md#requires-broad-rbac-scenarios-that-deliberately-cant-run-here).
