# Kubernetes (kubectl)

Real `kubectl`-observed cluster state, discovered by real labels — see
[BDD conventions](bdd-conventions.md) for the underlying pattern.

## Discovery

`Deployment`, `Service`, and `Pod` are all discovered the same way — by
real label selector, never a guessed/computed name. Each runs a real,
read-only `kubectl get` at construction time. `namespace` is the one
recognized non-label field; every other row is an arbitrary label
key/value used to build a `-l` selector. Requires the selector to match
**exactly one** real object; 0 or 2+ matches is a loud error (`Expected
exactly one <kind> matching ...`).

### Deployment

```gherkin
Given Deployment known as "<Alias>":
```

=== "Basic"

    ```gherkin
    Given Deployment known as "<NginxDeployment>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | nginx                     |
      | app.kubernetes.io/instance | sandbox-nginx-k8s-release |
    ```

=== "In practice"

    ```gherkin
    When I upgrade HelmRelease known as "<NginxRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace   | True  |
    Then the command exited with 0

    Given Deployment known as "<NginxDeployment>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | nginx                     |
      | app.kubernetes.io/instance | sandbox-nginx-k8s-release |
    ```

    `Deployment`/`Service` are always discovered *after* an `--atomic
    helm upgrade`, so they're already stable by the time this runs — a
    one-shot `get` is safe (`features/k8s/kubernetes.feature`).

### Service

```gherkin
Given Service known as "<Alias>":
```

=== "Basic"

    ```gherkin
    Given Service known as "<NginxService>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | nginx                     |
      | app.kubernetes.io/instance | sandbox-nginx-k8s-release |
    ```

=== "Advanced"

    ```gherkin
    Given Service known as "<NotesService>":
      | PROPERTY                   | VALUE                 |
      | namespace                  | thomas-helm-test    |
      | app.kubernetes.io/instance | sandbox-notes-release |
    And RestEndpoint known as "<NotesApi>":
      | PROPERTY | VALUE          |
      | service  | <NotesService> |
      | port     | 8000           |
    ```

    A `Service` wrapped as a [`RestEndpoint`](REST.md#restendpoint) —
    the same kind of exception as `HelmRelease.chart`, resolving to the
    real object instead of a string (`features/rest/notes.feature`).

### Pod

```gherkin
Given Pod known as "<Alias>":
```

A `Pod` is the one type in this family without an `--atomic`-style
stability guarantee — see [Polling](#polling) below for the full
mechanism.

=== "Basic"

    ```gherkin
    Given Pod known as "<NginxPod>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | nginx                     |
      | app.kubernetes.io/instance | sandbox-nginx-k8s-release |
    ```

=== "Advanced"

    ```gherkin
    Given Pod known as "<NginxPod>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | nginx                     |
      | app.kubernetes.io/instance | sandbox-nginx-k8s-release |
    When I poll Pod known as "<NginxPod>" every "3s" for up to "30s" until:
      | KEY           | CONDITION | VALUE   | OUTCOME |
      | status.phase  | equals    | Running | pass    |
    ```

    Discovering, then polling until ready
    (`features/k8s/kubernetes.feature`).

## Querying

Reading a discovered object's current state, events, or logs.

### Get an Object

```gherkin
When I get Deployment known as "<Alias>" with:
```

Runs `kubectl get <kind> <name> -n <namespace>` plus any supplied
options. Works the same for `Deployment`/`Service`/`Pod`.

```gherkin
When I get Deployment known as "<NginxDeployment>" with:
  | OPTION | VALUE |
  | -o     | json  |
Then the command result data has:
  | KEY                                         | CONDITION | VALUE |
  | status.readyReplicas                        | equals    | 1     |
  | metadata.labels."app.kubernetes.io/version" | equals    | 1.27  |
```

### Get Events

```gherkin
When I get events for Deployment known as "<Alias>" with:
```

Runs `kubectl get events` filtered to the object via
`--field-selector involvedObject.name=<name>,involvedObject.kind=<Kind>`.

```gherkin
When I get events for Deployment known as "<NginxDeployment>" with:
  | OPTION | VALUE |
Then the command exited with 0
```

### Get Logs

```gherkin
When I get logs for Deployment known as "<Alias>" with:
```

Runs `kubectl logs <kind>/<name> -n <namespace>` (not available for
`Service`, which has no logs).

```gherkin
When I get logs for Deployment known as "<NginxDeployment>" with:
  | OPTION | VALUE |
Then the command exited with 0
```

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
    state (`features/k8s/kubernetes.feature`). A real bad state can
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
(`features/rest/health.feature`'s readiness-flip scenario — proves
"removed from Service endpoints, not restarted" without a doomed
follow-up HTTP call.)

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
