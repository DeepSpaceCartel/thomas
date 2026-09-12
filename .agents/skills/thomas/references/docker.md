# Docker steps

Real `docker buildx` invocations against a real remote BuildKit
endpoint. See [`../SKILL.md`](../SKILL.md) first for the general
pattern this extends, and [`extending.md`](extending.md) for the
underlying Alias/DataTable methodology.

## The one Docker-domain type

- **`Docker Buildx Builder`** (`support/docker/docker_buildx_builder.ts`,
  class `DockerBuildxBuilder`) — a remote BuildKit endpoint (`name` +
  `endpoint`, no live check at construction — same reasoning as
  `RestEndpoint`).

## Steps

```gherkin
Given Docker Buildx Builder "<Alias>" named "<name>" at "<endpoint>"
Given Docker Buildx Builder known as "<Alias>":            # PROPERTY|VALUE: name, endpoint

When I create Docker Buildx Builder known as "<Alias>" with:   # docker buildx create --name <name> --driver remote <endpoint>
When I create Docker Buildx Builder "<Alias>" with {flags}
When I remove Docker Buildx Builder known as "<Alias>" with:   # docker buildx rm <name>
When I remove Docker Buildx Builder "<Alias>" with {flags}

When I build and push "<image-ref>" from "<build-context>" using Docker Buildx Builder known as "<Alias>" with:
When I build and push "<image-ref>" from "<build-context>" using Docker Buildx Builder known as "<Alias>" with {flags}
```

`build and push` runs `docker buildx build --builder <name> -t
<image-ref> --push <build-context> ...args`. `<build-context>` may be a
`<Resource>` alias (a `Directory`) or a literal path.

**Named exception** (documented in `AGENTS.md`, same category as
`HelmRelease.chart`): an `OPTION|VALUE` row `--registry-credentials
<FileAlias>` is intercepted, never passed to `docker` argv literally —
it resolves `<FileAlias>` to a real docker-config-JSON `File` and turns
it into a scoped `DOCKER_CONFIG` env dir (real env-var isolation via
`run_command.ts`'s `env` option, copying ambient `buildx/` state first
so the already-created builder stays visible).

No new assertion vocabulary — every action sets `lastCommandResult`,
reuse `common.step.ts`'s generic exit-code/output/JMESPath `Then` steps.

**In practice** — short oneline, and the full `DataTable` it's
equivalent to:

```gherkin
Given Docker Buildx Builder "<RemoteBuilder>" named "ci" at "tcp://buildkit:1234"
When I create Docker Buildx Builder known as "<RemoteBuilder>"
Then the command exited with 0
When I build and push "registry.example.com/app:v1" from "./app" using Docker Buildx Builder known as "<RemoteBuilder>" with --platform linux/amd64
Then the command exited with 0
When I remove Docker Buildx Builder known as "<RemoteBuilder>"
Then the command exited with 0
```

## Dogfooding fixtures

`features/docker/docker-buildx-builder-{short,full}.feature` stand up a
real, disposable registry (`charts/test-registry`) and a real,
disposable BuildKit instance (`buildkit-service` chart +
`fixtures/docker/buildkitd.toml` trusting that registry as plain HTTP)
in `thomas-helm-test`, per-scenario. **Prerequisite**: `thomas-helm-test`
is labeled `pod-security.kubernetes.io/enforce: privileged` — a real
BuildKit pod needs privileged (or rootless-unconfined) execution, which
the default `baseline` level blocks. This is a one-time namespace setup
step, not something the feature files do themselves.
