# test-rest-api

A real, deployed FastAPI test-fixture app for exercising Thomas's HTTP
BDD steps (`support/http/`, `step_definitions/http/http.step.ts`) against a
real running application, not just Helm/kubectl-observed state. Every
design choice below was deliberate and is worth preserving when
extending it.

## Endpoints (current, Phase 3)

- `GET /health/startup` / `/health/ready` / `/health/live` - k8s probe
  endpoints. `PUT /_test/ready?ready=<bool>` is a deliberate,
  non-production test-control endpoint for flipping readiness on demand.
- `/notes/` - in-memory JSON CRUD (`POST`/`GET`/`GET {id}`/`PUT {id}`/
  `DELETE {id}`).
- `/files/` - real file upload/download (`POST` multipart, `GET`/
  `GET {id}` metadata, `GET {id}/download` raw bytes, `DELETE {id}`) -
  real bytes on a writable `/data` `emptyDir` volume.

- `/users/` - in-memory user CRUD with password, API-key, and bearer-token
  credentials. Generated API keys are returned only on create/rotation.
- `/auth/api-key/whoami` - `X-API-Key` authentication.
- `/auth/basic/whoami` - HTTP Basic authentication.
- `/auth/token` and `/auth/bearer/whoami` - password-backed bearer JWT.
- `/auth/oauth2/whoami` - OAuth2 access-token validation.
- `/auth/openid/whoami` - OIDC ID-token validation.
- `/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`, `/oauth/jwks`, and
  `/.well-known/openid-configuration` - self-hosted authorization-code and
  OIDC endpoints. The disposable fixture accepts explicit username/password
  query parameters on `/oauth/authorize` because the BDD client has no browser
  session flow.

## No custom container image — deliberate, not a shortcut

Building and pushing a custom image needs real infra (a registry,
credentials, a build pipeline) that not every environment running this
suite has readily available. Rather than requiring that just to get one
test fixture running, this chart mounts the app's real `.py` source from
a **ConfigMap** onto a stock `python:3.12-slim`, and installs
dependencies for real at pod startup:
```yaml
args:
  - |
    set -e
    pip install --no-cache-dir fastapi==... "uvicorn[standard]"==... "python-multipart"==...
    exec uvicorn main:app --host 0.0.0.0 --port {{ .Values.service.port }} --app-dir /app
```
Tradeoff, stated plainly: slower pod startup (a real, uncached `pip
install` over the network), no build-time dependency pinning beyond
`values.yaml`'s `pipVersions`.

## Source layout / adding a new `.py` file

`templates/configmap.yaml` uses `(.Files.Glob "files/*.py").AsConfig` —
any new file under `charts/test-rest-api/files/*.py` is automatically
picked up in the rendered ConfigMap, **no chart template change
needed**. Just:
1. Add the file, define an `APIRouter` if it's a new resource group
   (see `notes.py`/`files.py`/`health.py` as templates — small, focused,
   one resource group per file, `router = APIRouter(prefix="...",
   tags=[...])`). Module-level state that needs sharing across files
   (like `health.py`'s readiness flag, read by `test_control.py`) is
   just a plain importable module attribute — no shared-state framework
   needed for a fixture this size.
2. `main.py` needs `import <module>` + `app.include_router(<module>.router)`.
3. If it needs a new pip package, add it to `values.yaml`'s
   `pipVersions` and the `pip install` line in `templates/deployment.yaml`.
   Phase 3 pins `bcrypt`, `cryptography`, and `python-jose[cryptography]`
   alongside the existing FastAPI dependencies.

## The `checksum/app-config` rollout trick

Kubernetes does **not** restart a pod just because a referenced
ConfigMap's data changed — the pod template itself is unchanged, so a
plain `helm upgrade` silently no-ops on the running pod. The pod-template
annotation `checksum/app-config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}`
forces a real rollout whenever the *rendered* ConfigMap content changes
— confirmed for real (a no-op `helm upgrade` left the same pod name; a
real one-line source edit produced a new pod name). This covers both
"changed an existing file's content" and "added a new file" identically
— both change what the glob-and-hash renders, so no case-by-case
verification is needed each time, only when the mechanism itself
changes.

## Health probes — designed to actually be exercised, not trivially green

- `/health/startup` — false for a real ~5s (an async startup task, not
  a sleep in the probe handler) before flipping true, so the
  `startupProbe` genuinely blocks on real app state, not an instantly-
  passing check. `startupProbe`'s `periodSeconds`/`failureThreshold`
  budget must absorb the real, uncached `pip install` time — calibrate
  from an actually observed pod start (`kubectl get pod -w`), don't
  guess a number.
- `/health/ready` — normally 200, flippable to 503 via `PUT
  /_test/ready?ready=<bool>` (query param, not a JSON body field — see
  why below). This is the **one** deliberate non-production addition to
  the app, needed so a scenario can actually *witness* "removed from
  Service endpoints, not restarted" end-to-end rather than merely
  asserting it from Kubernetes docs.
- `/health/live` — always 200 currently; no state exists yet whose
  corruption would represent a genuine, restart-worthy deadlock. If a
  future addition needs to test liveness failure for real, it needs a
  similarly deliberate, clearly-commented test-control mechanism — don't
  make `/health/live` fail on something that isn't genuinely
  unrecoverable, that's exactly the anti-pattern k8s's own probe
  guidance warns about (liveness should only restart on a truly
  unrecoverable condition).

`ready` is a **query parameter**, not a JSON body field, specifically
because this framework's `FIELD` request-table rows always send string
values (`"false"`, not JSON `false`) — FastAPI's query-parameter bool
coercion handles `"true"`/`"false"` strings correctly; a JSON body model
field typed `bool` would not, without extra validator work this endpoint
doesn't need.

## Storage: in-memory vs. real bytes on disk

- `notes.py` — pure in-memory `dict`, deliberately. Disposable test
  fixture, doesn't need to survive a restart.
- `files.py` — real bytes written to `/data`, a **second**, read-write
  `emptyDir` volume distinct from the read-only ConfigMap-mounted `/app`
  the source itself lives in. Metadata (filename/size/content_type) is
  a separate in-memory index — not derivable from the on-disk bytes
  alone, so it's tracked alongside them, not instead of them.
- File endpoints separate metadata from content as distinct
  representations: `GET /files/{id}` answers "what is this" (JSON),
  `GET /files/{id}/download` answers "give me the actual bytes" (raw,
  with a real `Content-Disposition`) — not one route conflating both.

## Optional real TLS listener (`values.tls.enabled`)

Off by default, zero risk to every scenario that doesn't set it. When
enabled (`--set tls.enabled=true`), a **second** `uvicorn` process binds
`values.tls.port` (default `8443`) using its own native
`--ssl-keyfile`/`--ssl-certfile` flags against a real, self-signed
cert-manager `Certificate` (`templates/tls-issuer.yaml` /
`tls-certificate.yaml`, same pattern as `charts/test-tls-demo` — see its
README) — the existing plain-HTTP listener (still what the k8s probes
use) keeps running unchanged alongside it.

**The Certificate uses `dnsNames` only, no `commonName`** — a real
in-cluster Service FQDN (`<fullname>.<namespace>.svc.cluster.local`)
routinely exceeds X.509's hard 64-byte `commonName` limit; confirmed
live the first time this was built (`cert-manager`'s own admission
webhook rejected it outright: `spec.commonName: Too long: may not be
more than 64 bytes`). Modern TLS clients (this project's `undici` Agent
included) verify a certificate's hostname against SAN/`dnsNames`, never
`commonName`, so dropping it loses no real verification. `values.tls.dnsName`
defaults to that real Service FQDN — matching the exact hostname
`RestEndpoint.baseUrl` connects to is what makes real TLS hostname
verification pass at all; a fixed, namespace-agnostic default was tried
first and every real HTTPS request against it failed hostname
verification for real.

## Real cluster facts worth not re-deriving

- This shell has direct DNS/network routing to in-cluster Service DNS
  names — no `kubectl port-forward` needed for `fetch()`/`curl` from
  the test process.
- Node's global `FormData`/`Blob`/`File` are real (Node 20+, via
  undici) — no npm dependency needed for multipart client construction.
- FastAPI's file-upload support requires `python-multipart` installed —
  a real, documented FastAPI requirement, not optional.
