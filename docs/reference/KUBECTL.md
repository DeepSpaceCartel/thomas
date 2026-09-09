# Kubernetes (kubectl)

Real `kubectl`-observed cluster state, discovered by real labels — see
[BDD conventions](../concepts/bdd-conventions.md) for the underlying pattern.

## Discovery

`Deployment`, `Service`, `Pod`, `ConfigMap`, `ReplicaSet`, and `Secret`
are all discovered the same way — by real label selector, never a
guessed/computed name. Each runs a real, read-only `kubectl get` at
construction time. `namespace` is the one recognized non-label field;
every other row is an arbitrary label key/value used to build a `-l`
selector. Requires the selector to match **exactly one** real object; 0
or 2+ matches is a loud error (`Expected exactly one <kind> matching
...`).

### Deployment

=== "Short"

    ```gherkin
    Given Deployment "<NginxDeployment>"
    And "<NginxDeployment>" namespace is "thomas-helm-test"
    And "<NginxDeployment>" label "app.kubernetes.io/name" is "test-nginx"
    And "<NginxDeployment>" label "app.kubernetes.io/instance" is "thomas-nginx-k8s-release"
    ```

=== "Full"

    ```gherkin
    Given Deployment known as "<NginxDeployment>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release  |
    ```

Both forms run the identical real, one-time `kubectl get` — see
[Progressive Discovery](#progressive-discovery) below for how the short
form resolves lazily. The two are otherwise interchangeable; pick
whichever reads better for the number of labels a scenario needs.

=== "Discovering after an atomic upgrade"

    ```gherkin
    When I upgrade Helm Release known as "<NginxRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace   | True  |
    Then the command exited with 0

    Given Deployment known as "<NginxDeployment>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release |
    ```

    `Deployment`/`Service` are always discovered *after* an `--atomic
    helm upgrade`, so they're already stable by the time this runs — a
    one-shot `get` is safe.

### Service

=== "Short"

    ```gherkin
    Given Service "<RestApiService>"
    And "<RestApiService>" namespace is "thomas-helm-test"
    And "<RestApiService>" label "app.kubernetes.io/instance" is "thomas-rest-api-release"
    ```

=== "Full"

    ```gherkin
    Given Service known as "<NginxService>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release  |
    ```

=== "Wrapped as an HTTP Endpoint"

    ```gherkin
    Given Service known as "<NotesService>":
      | PROPERTY                   | VALUE                 |
      | namespace                  | thomas-helm-test    |
      | app.kubernetes.io/instance | thomas-notes-release |
    And HTTP Endpoint "<NotesApi>" on "<NotesService>" port "8000"
    ```

    A `Service` wrapped as an [HTTP/HTTPS
    Endpoint](REST.md#httphttps-endpoint) — the same kind of exception as
    `HelmRelease.chart`, resolving to the real object instead of a
    string.

### Pod

A `Pod` is the one type in this family without an `--atomic`-style
stability guarantee — see [Polling](#polling) below for the full
mechanism.

=== "Short"

    ```gherkin
    Given Pod "<NginxPod>"
    And "<NginxPod>" namespace is "thomas-helm-test"
    And "<NginxPod>" label "app.kubernetes.io/name" is "test-nginx"
    And "<NginxPod>" label "app.kubernetes.io/instance" is "thomas-nginx-k8s-release"
    ```

=== "Full"

    ```gherkin
    Given Pod known as "<NginxPod>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release  |
    ```

=== "Discover, then poll until ready"

    ```gherkin
    Given Pod known as "<NginxPod>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release |
    When I poll Pod known as "<NginxPod>" every "3s" for up to "30s" until:
      | KEY           | CONDITION | VALUE   | OUTCOME |
      | status.phase  | equals    | Running | pass    |
    ```

### ConfigMap

No `logs` (same as `Service` — see [Get Logs](#get-logs) below). Unlike
`ReplicaSet`, a chart's `ConfigMap` is not versioned per revision, so
it's safe to discover regardless of how many times the owning release
has been upgraded.

=== "Short"

    ```gherkin
    Given ConfigMap "<RestApiConfigMap>"
    And "<RestApiConfigMap>" namespace is "thomas-helm-test"
    And "<RestApiConfigMap>" label "app.kubernetes.io/instance" is "thomas-rest-api-release"
    When I get ConfigMap "<RestApiConfigMap>" as JSON
    Then the command result has "data.\"notes.py\"" exists
    ```

=== "Full"

    ```gherkin
    Given ConfigMap known as "<RestApiConfigMap>":
      | PROPERTY                   | VALUE                    |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/instance | thomas-rest-api-release   |
    When I get ConfigMap known as "<RestApiConfigMap>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY             | CONDITION | VALUE |
      | data."notes.py" | exists    |       |
    ```

### ReplicaSet

!!! warning "Only safe against a release installed once and never upgraded again"
    A Deployment keeps its old ReplicaSets around by default
    (`revisionHistoryLimit`), and *every* one of them — old or current —
    carries the same `app.kubernetes.io/name`/`instance` labels as the
    Deployment itself. Discovering a `ReplicaSet` against a release
    that's been upgraded or rolled back more than once genuinely matches
    more than one real object and fails the same way any other
    ambiguous selector does (`Expected exactly one replicaset matching
    ...`). Only use it against a release installed once, like
    `<NginxRelease>` below — never against one that's been rolled back, like `<RollbackRelease>` in [Helm: Manage a Release](HELM.md#manage-a-release).

=== "Short"

    ```gherkin
    Given ReplicaSet "<NginxReplicaSet>"
    And "<NginxReplicaSet>" namespace is "thomas-helm-test"
    And "<NginxReplicaSet>" label "app.kubernetes.io/name" is "test-nginx"
    And "<NginxReplicaSet>" label "app.kubernetes.io/instance" is "thomas-nginx-k8s-release"
    When I get ReplicaSet "<NginxReplicaSet>" as JSON
    Then the command result has "status.replicas" is 1
    ```

=== "Full"

    ```gherkin
    Given ReplicaSet known as "<NginxReplicaSet>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release  |
    When I get ReplicaSet known as "<NginxReplicaSet>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY             | CONDITION | VALUE |
      | status.replicas | equals    | 1     |
    ```

### Secret

No `logs` (same as `Service`/`ConfigMap`). Unlike the other kinds here,
a `Secret` created by a controller reacting to some other resource
(rather than templated directly by the chart) isn't guaranteed to exist
the instant this runs — see [TLS Certificates](#tls-certificates) below,
where discovery retries for exactly that reason.

!!! note "Secret's short form is a Payload accumulator, not progressive discovery"
    Progressive discovery (used by every other kind above) resolves
    through `discoverByFields` directly, on first use — bypassing
    `Secret`'s own bounded retry entirely. The [Payload
    accumulator](../concepts/bdd-conventions.md#construction) instead
    flows through `secretFromFields`, the same real retry-bearing
    function the table form calls, so the short form doesn't lose
    correctness for speed.

=== "Short"

    ```gherkin
    Given "<TlsDemoSecretPayload>" field "namespace" is "thomas-helm-test"
    And "<TlsDemoSecretPayload>" field "app.kubernetes.io/instance" is "thomas-tls-demo-release"
    Given Secret known as "<TlsDemoSecret>" using "<TlsDemoSecretPayload>"
    ```

=== "Full"

    ```gherkin
    Given Secret known as "<TlsDemoSecret>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/instance | thomas-tls-demo-release   |
    ```

`helm uninstall` only removes what Helm itself templated — a Secret
created by another controller (cert-manager, here) has no
`ownerReference` back to it and is left behind. Clean it up explicitly:

```gherkin
When I delete Secret known as "<TlsDemoSecret>"
Then the command exited with 0
```

`I delete {word} known as "<Alias>"` works generically for any
discovered kind, not just `Secret` — it exists specifically for cases
like this one where Helm doesn't own the cleanup.

### Progressive Discovery

A second, additive construction style for any kind above — the same
real, one-time `kubectl get`, just spread across several `Given` lines
instead of one table, for when that reads better than a table with only
one or two rows:

```gherkin
Given Deployment "<NginxDeployment>"
And "<NginxDeployment>" namespace is "dev"
And "<NginxDeployment>" label "app.kubernetes.io/instance" is "nginx-release"
```

No real command runs until the object is actually used by a later
`When`/`Then` step — with this style the full selector genuinely isn't
known until the last `And` line, so the real check happens then, with
the same "expected exactly one match" error as the table form. The
table form is unchanged and still resolves immediately; use whichever
reads better for the number of predicates a scenario actually needs.

## Querying

Reading a discovered object's current state, events, or logs. Works the
same for every kind above.

### Get an Object

```gherkin
When I get {word} known as "<Alias>"
When I get {word} known as "<Alias>" with:
When I get {word} "<Alias>" with {flags}
When I get {word} "<Alias>" as {outputFormat}
```

Runs `kubectl get <kind> <name> -n <namespace>` plus any supplied
options — `{word}` is the kind (`Deployment`, `Service`, `Pod`,
`ConfigMap`, `ReplicaSet`). Since `--output json`/`--output yaml` alone
is by far the most common real case, there's a dedicated `as
{outputFormat}` shorthand for exactly that, alongside the general
`with {flags}` short form for anything else:

=== "Short"

    ```gherkin
    When I get Deployment "<NginxDeployment>" as JSON
    Then Deployment "<NginxDeployment>" has "status.readyReplicas" >= 1
    ```

=== "Full"

    ```gherkin
    When I get Deployment known as "<NginxDeployment>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY                                          | CONDITION | VALUE |
      | status.readyReplicas                         | equals    | 1     |
      | status.readyReplicas                         | gte       | 1     |
      | metadata.labels."app.kubernetes.io/version"  | equals    | 1.27  |
    ```

The `Then` in the short form is object-flavored — see [Object-Flavored
Assertions](#object-flavored-assertions) below.

### Get Events

```gherkin
When I get events for {word} known as "<Alias>"
When I get events for {word} known as "<Alias>" with:
When I get events for {word} "<Alias>" with {flags}
```

Runs `kubectl get events` filtered to the object via
`--field-selector involvedObject.name=<name>,involvedObject.kind=<Kind>`.

=== "Short"

    ```gherkin
    When I get events for Deployment "<NginxDeployment>" with --show-kind
    Then the command exited with 0 STDOUT contains "Scaled up replica set"
    ```

=== "Full"

    ```gherkin
    When I get events for Deployment known as "<NginxDeployment>" with:
      | OPTION      | VALUE |
      | --show-kind | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                 |
      | STDOUT | contains  | Scaled up replica set |
    ```

For asserting on event content as it becomes available rather than a
one-shot snapshot, pair this with a poll instead — see [Poll Logs or
Events for a Pod](#poll-logs-or-events-for-a-pod). The table-less form
(nothing to shorten) works identically in both syntaxes:
```gherkin
When I get events for Deployment known as "<NginxDeployment>"
Then the command exited with 0
```

### Get Logs

```gherkin
When I get logs for {word} known as "<Alias>"
When I get logs for {word} known as "<Alias>" with:
When I get logs for {word} "<Alias>" with {flags}
```

Runs `kubectl logs <kind>/<name> -n <namespace>` — not available for
`Service`/`ConfigMap`, which have no logs.

=== "Short"

    ```gherkin
    When I get logs for Deployment "<NginxDeployment>" with --timestamps
    Then the command exited with 0 STDOUT contains "Configuration complete; ready for start up"
    ```

=== "Full"

    ```gherkin
    When I get logs for Deployment known as "<NginxDeployment>" with:
      | OPTION       | VALUE |
      | --timestamps | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                      |
      | STDOUT | contains  | Configuration complete; ready for start up |
    ```

The table-less form (nothing to shorten) works identically in both
syntaxes:
```gherkin
When I get logs for Deployment known as "<NginxDeployment>"
Then the command exited with 0
```

### Object-Flavored Assertions

```gherkin
Then {word} "<Alias>" has "<key>" <condition> <value>
```

A sibling of `the command result has ...` named after the object
instead — still only ever reads the same captured result from the `When
I get ...` step right above it, never a new real check. The value it
adds: it verifies `"<Alias>"` is a genuinely registered object of that
kind *first*, throwing if it isn't — catching a copy-paste kind/alias
mismatch before comparing anything.

```gherkin
When I get Deployment "<NginxDeployment>" as JSON
Then Deployment "<NginxDeployment>" has "status.readyReplicas" >= 1
```

`<condition>` accepts either word (`gte`) or symbol (`>=`) form — real
aliases for the same check, not two different vocabularies; see [BDD
conventions](../concepts/bdd-conventions.md#conditions).

## Polling

Real, repeated checks for a `Pod`'s eventually-consistent state — the
one alias type without an `--atomic`-style stability guarantee.

### Poll a Pod

```gherkin
When I poll Pod known as "<Alias>" every "<interval>" for up to "<timeout>" until:
```

A `Pod` can be `Pending` for a real, variable time. This re-runs a real
`kubectl get pod -o json` every interval (never re-checks stale data)
until every `pass`-`OUTCOME` row holds (success), any `fail`-`OUTCOME`
row holds (immediate failure, no need to exhaust the timeout on a state
that's already terminal-bad), or the timeout elapses (failure, with the
last real observed state reported). There is also
`When I attempt to poll Pod ...` (wraps the poll for negative tests).

!!! warning "cucumber-js's own default step timeout is 5000ms"
    Shorter than a legitimate real poll used in this suite (up to 2
    minutes for the fast-fail example below). This is already handled
    globally (`support/hooks.ts` raises it via `setDefaultTimeout`) — if
    you add a new poll with a longer real timeout than anything
    existing, check that value is still comfortably above your new
    longest real wait; don't assume it's covered forever.

=== "Minimal"

    ```gherkin
    When I poll Pod known as "<NginxPod>" every "3s" for up to "30s" until:
      | KEY                                              | CONDITION | VALUE            | OUTCOME |
      | status.phase                                     | equals    | Running          | pass    |
      | status.containerStatuses[0].ready                | equals    | true             | pass    |
      | status.containerStatuses[0].state.waiting.reason | equals    | CrashLoopBackOff | fail    |
    ```

=== "Fast-failing on a bad image"

    ```gherkin
    When I attempt to poll Pod known as "<BadImagePod>" every "3s" for up to "2m" until:
      | KEY                                              | CONDITION | VALUE            | OUTCOME |
      | status.phase                                     | equals    | Running          | pass    |
      | status.containerStatuses[0].state.waiting.reason | equals    | ErrImagePull     | fail    |
      | status.containerStatuses[0].state.waiting.reason | equals    | ImagePullBackOff | fail    |
    Then it should have failed with either:
      | MESSAGE          |
      | ErrImagePull     |
      | ImagePullBackOff |
    ```

    The preceding install deliberately omits `--atomic`, which would
    otherwise block and auto-roll-back before this could observe the bad
    state. A real bad state can
    genuinely be observed as more than one real message across ticks —
    pair a fast-fail poll with `it should have failed with either:`, not
    the single-message form.

### Poll Logs or Events for a Pod

```gherkin
When I poll logs for Pod known as "<Alias>" every "<interval>" for up to "<timeout>" until:
```

Same polling mechanism, but against raw `kubectl logs`/`get events` text
instead of structured JSON — uses `SOURCE|CONDITION|VALUE|OUTCOME` rows
(`SOURCE` is `STDOUT`/`STDERR`) instead of `KEY`.

=== "Logs"

    ```gherkin
    When I poll logs for Pod known as "<NginxPod>" every "3s" for up to "15s" until:
      | SOURCE | CONDITION | VALUE                                       | OUTCOME |
      | STDOUT | contains  | Configuration complete; ready for start up | pass    |
    ```

=== "Events"

    ```gherkin
    When I poll events for Pod known as "<NginxPod>" every "3s" for up to "15s" until:
      | SOURCE | CONDITION | VALUE   | OUTCOME |
      | STDOUT | contains  | Started | pass    |
      | STDOUT | contains  | BackOff | fail    |
    ```

### Poll Structured Events for a Pod

```gherkin
When I poll structured events for Pod known as "<Alias>" every "<interval>" for up to "<timeout>" until:
```

The raw-text form above only ever substring-matches the whole combined
`kubectl get events` output — it can't tell a `Reason` value apart from
a `Message` value, only as accidentally-adjacent substrings of the same
blob. This structured sibling reuses the same JSON-polling mechanism
`poll Pod` uses, fed from `kubectl get events -o json` instead, so
`Reason`/`Message` become real, separately-queryable `KEY`s
(`items[*].reason`/`items[*].message` — array projection over the real
events list, existential by default: passes if *any* event matches).

```gherkin
When I poll structured events for Pod known as "<EventsPod>" every "3s" for up to "60s" until:
  | KEY               | CONDITION | VALUE                 | OUTCOME |
  | items[*].reason    | contains  | Unhealthy             | pass    |
  | items[*].message   | contains  | Startup probe failed  | pass    |
```

Exercised against a real, transient startup-probe failure in
`features/k8s/events-{short,full}.feature`:
`charts/test-rest-api` installed *without* `--atomic` genuinely produces
a real `Unhealthy` event with a `Startup probe failed` message during
its own uncached `pip install` window — confirmed live via `kubectl get
events -o json` before writing the scenario — followed by a real
recovery once the app finishes starting.

### A Service can't route to a Pod it just excluded

!!! danger "Don't expect an error status from an already-NotReady Pod's Service"
    Once a Pod is confirmed NotReady (proven via a Pod-status poll), it
    has been removed from its Service's endpoints entirely. Don't write
    a follow-up [REST](REST.md) request expecting a real error status
    from that Service — the request fails to connect, it doesn't return
    the app's own error response. Assert the readiness state directly
    instead:

```gherkin
When I poll Pod known as "<ReadinessPod>" every "3s" for up to "30s" until:
  | KEY                                      | CONDITION | VALUE | OUTCOME |
  | status.containerStatuses[0].ready        | equals    | false | pass    |
  | status.containerStatuses[0].restartCount | equals    | 0     | pass    |
```

## Exec Into a Pod

```gherkin
When I exec "<command>" in Pod known as "<Alias>"
```

For the checks `get`/`logs`/`events` genuinely can't answer from the
outside — a mounted file's real content, an env var, whether a process
is actually running. Runs a real `kubectl exec <pod> -n <namespace> --
sh -c "<command>"`, piped through a real shell so pipes/redirects in
`<command>` work unmodified. Result lands in the same
`lastCommandResult` slot as every other command, so the existing `the
command exited with {int}[:]` steps assert on it unchanged — no new
vocabulary.

```gherkin
When I exec "cat /etc/nginx/conf.d/default.conf" in Pod known as "<NginxPod>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE        |
  | STDOUT | contains  | location / { |
```

## Checking RBAC Permissions

```gherkin
When I check if Pod known as "<Alias>" can "<verb>" "<resource>"
```

A different axis from everything above — permissions, not state. Fetches
the Pod's real `spec.serviceAccountName` with a fresh `kubectl get pod
-o json` (not cached from discovery — this checks the account actually
running the workload right now), then runs a real `kubectl auth can-i
<verb> <resource> --as=system:serviceaccount:<namespace>:<serviceAccount>
-n <namespace>`. `kubectl auth can-i` is itself the real assertion
mechanism — it exits 0 when allowed, 1 when denied — so `the command
exited with {int}` already covers "was this allowed", zero new
vocabulary.

```gherkin
When I check if Pod known as "<NginxPod>" can "create" "deployments"
Then the command exited with 1
```

This Pod's real ServiceAccount is the namespace's `default` (the chart
declares none), which genuinely cannot create Deployments under standard
RBAC — a real, true assertion, not a fixture rigged to fail.

## TLS Certificates

```gherkin
When I inspect the certificate in Secret known as "<Alias>"
```

Extracts `data."tls.crt"` from a real `kubernetes.io/tls` Secret's real
JSON, base64-decodes it to a real temp file, and runs a real `openssl
x509 -in <path> -noout -subject -enddate -ext subjectAltName` against
it — real `openssl`, not a bespoke ASN.1 parser. Result lands in
`lastCommandResult`, so `the command exited with {int}:` plus
`SOURCE|CONDITION|VALUE` against the real, parsed subject/expiry/SANs
needs no new assertion vocabulary either.

```gherkin
Given Directory "<TlsDemoChartDirectory>" at "./charts/test-tls-demo"
And Helm Chart "<TlsDemoHelmChart>" in "<TlsDemoChartDirectory>"
And Helm Release "<TlsDemoRelease>" of "<TlsDemoHelmChart>" named "thomas-tls-demo-release" in "thomas-helm-test"
When I upgrade Helm Release known as "<TlsDemoRelease>" with:
  | OPTION             | VALUE |
  | --install          | True  |
  | --atomic           | True  |
  | --create-namespace | True  |
Then the command exited with 0

Given Secret known as "<TlsDemoSecret>":
  | PROPERTY                   | VALUE                    |
  | namespace                  | thomas-helm-test         |
  | app.kubernetes.io/instance | thomas-tls-demo-release |
When I inspect the certificate in Secret known as "<TlsDemoSecret>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                            |
  | STDOUT | contains  | CN=demo.thomas-helm-test.local   |
  | STDOUT | contains  | DNS:demo.thomas-helm-test.local  |
```

!!! warning "This cluster's real cert-manager talks to a real, production ACME account"
    `charts/test-tls-demo/` deliberately uses a namespaced, `selfSigned`
    `Issuer` — no ACME, no DNS-01, no shared rate limit. This cluster's
    default `ClusterIssuer` is wired to a real Let's Encrypt account with
    real AWS Route53 credentials; a fixture chart requesting a
    certificate from *that* issuer would issue a real production
    certificate and touch real DNS on every test run. Follow the same
    pattern (a scenario-local `selfSigned` `Issuer`) for any new
    TLS-testing fixture rather than pointing at the cluster's real one.
    `charts/test-rest-api/`'s own optional `values.tls.enabled` listener
    (see [REST: Define an HTTPS
    Endpoint](REST.md#define-an-https-endpoint)) follows this exact same
    pattern.

The same `data["tls.crt"]` this section decodes with `openssl` is also
what an [HTTPS Endpoint](REST.md#define-an-https-endpoint) trusts a real
server certificate against — a self-signed cert is its own CA, so no
separate `ca.crt` field or Secret shape is needed for that.

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
