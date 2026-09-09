# Fixtures and charts

The [`charts/`](https://github.com/DeepSpaceCartel/thomas/tree/main/charts)
directory contains small deployable fixtures used by the real integration
tests. Files used by upload/download scenarios live under
`features/fixtures/` (e.g. `hello.txt`, used by
[REST](../reference/REST.md)'s file-upload examples). Nothing here is
mocked — a fixture exists to prove one real, observable behavior.

## [`charts/test-nginx/`](https://github.com/DeepSpaceCartel/thomas/tree/main/charts/test-nginx)

Minimal, off-the-shelf `nginx` image — a Deployment, Service, and
test-hook Pod, zero custom application logic. The default template for
a new "just needs a Deployment+Service" fixture. Its label set covers
every "recommended" label from
[Helm's own chart-best-practices guide](https://helm.sh/docs/chart_best_practices/labels/):
`app.kubernetes.io/name`/`instance`/`managed-by`/`version` and
`helm.sh/chart`.

!!! warning "Quote `AppVersion` in labels, or `helm upgrade` fails"
    `app.kubernetes.io/version` **must** be rendered with `| quote`
    (`{{ .Chart.AppVersion | quote }}`) — unquoted, a numeric-looking
    `AppVersion` (e.g. `1.27`) renders into the labels YAML block as a
    bare value, which YAML parses as a float instead of a string, and
    `helm upgrade` then fails outright decoding it into a
    `map[string]string`. A real bug this chart hit once, not a
    hypothetical one.

`charts/test-nginx-0.1.0.tgz` is regenerated fresh from `charts/test-nginx/`
before every run (a `BeforeAll` hook, a real `helm package`), so a
"Local Archive Chart" scenario can never silently test stale content.

## [`charts/test-dependency/`](https://github.com/DeepSpaceCartel/thomas/tree/main/charts/test-dependency)

Exists *solely* to declare a real dependency (on a small, public
`metrics-server` repo) for exercising `helm dependency
build`/`list`/`update` — see
[Helm](../reference/HELM.md#manage-directory-dependencies).
Its `Chart.lock` and downloaded `charts/` subdirectory are real,
regenerated artifacts (gitignored), not something to hand-edit.

## [`charts/test-rest-api/`](https://github.com/DeepSpaceCartel/thomas/tree/main/charts/test-rest-api)

A real, deployed FastAPI application used by every
[REST](../reference/REST.md) scenario. Notably built with **no custom
container image** — its real Python source is mounted from a ConfigMap
onto a stock `python:3.12-slim`, with dependencies installed for real
at pod startup (`pip install ... && exec uvicorn ...`). This avoids
needing a custom-image build/push pipeline, at the cost of slower pod
startup and no build-time dependency pinning beyond the chart's own
`values.yaml`.

A `checksum/app-config` pod-template annotation forces a real rollout
whenever the ConfigMap's rendered content changes — Kubernetes does not
restart a pod just because a referenced ConfigMap's data changed on its
own. Health probes are designed to actually be exercised: `/health/ready`
is flippable via `PUT /_test/ready?ready=<bool>`, used by
[Kubernetes](../reference/KUBECTL.md#a-service-cant-route-to-a-pod-it-just-excluded)'s
readiness-flip example to prove a Pod is really removed from Service
endpoints, not restarted.

Adding a new endpoint here is a design decision of its own — see
`charts/test-rest-api/README.md` for the full rationale (storage
choices, the ConfigMap-glob mechanism, probe design) before changing
this chart.

## [`charts/test-tls-demo/`](https://github.com/DeepSpaceCartel/thomas/tree/main/charts/test-tls-demo)

A namespaced cert-manager `Issuer` (`spec.selfSigned: {}`) plus a
`Certificate` requesting a real TLS Secret — used by [Kubernetes: TLS
Certificates](../reference/KUBECTL.md#tls-certificates). Deliberately
self-signed: this cluster's real default `ClusterIssuer` is wired to a
production Let's Encrypt account over real Route53 DNS-01, and a
fixture requesting a certificate from *that* issuer would issue a real
production certificate on every test run. `secretTemplate.labels` on
the `Certificate` mirrors the chart's own `app.kubernetes.io/name`/
`instance` labels, so the resulting Secret is discoverable the same way
as any other fixture's objects.

## Adding a fixture

Keep fixtures small, deterministic, and useful for proving one behavior
at a time. The harness never mocks a Kubernetes API or HTTP server —
when adding a fixture, document the observable contract it provides and
verify important values (a log substring, an event reason, a field
path) from real captured output before writing them into a `.feature`
file.
