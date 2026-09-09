# kubectl steps

Real `kubectl`-observed cluster state. See [`../SKILL.md`](../SKILL.md)
first for the general pattern this extends.

## Discovery by label selector, not by name

`Deployment`/`Service`/`Pod` are discovered by real Kubernetes labels,
not a guessed/computed resource name:

```gherkin
Given Deployment known as "<NginxDeployment>":
  | PROPERTY                   | VALUE                     |
  | namespace                  | thomas-helm-test        |
  | app.kubernetes.io/name     | nginx                     |
  | app.kubernetes.io/instance | sandbox-nginx-k8s-release |
```
`namespace` is the one recognized non-label field; every other row is an
arbitrary label key/value used to build a `-l` selector — there is no
closed field list to validate against, since a real chart's label set
can't be enumerated in advance. Discovery requires the selector to match
**exactly one** real object — 0 or 2+ matches is a loud error
(`Expected exactly one <kind> matching ...`), never a silent pick-first.
This runs a real, read-only `kubectl get` at `Given` time.

## Querying a discovered object

```gherkin
When I get Deployment known as "<Alias>" with:              # kubectl get deployment <name> -n <namespace>
When I get events for Deployment known as "<Alias>" with:    # kubectl get events --field-selector involvedObject.name=...
When I get logs for Deployment known as "<Alias>" with:       # kubectl logs deployment/<name>
```
`Service` supports `get`/`get events` (no `logs` — a Service has none);
`Pod` supports all three, plus the polling steps below.

**In practice** (`features/k8s/kubernetes.feature`):
```gherkin
When I get Deployment known as "<NginxDeployment>" with:
  | OPTION | VALUE |
  | -o     | json  |
Then the command result data has:
  | KEY                                         | CONDITION | VALUE |
  | status.readyReplicas                        | equals    | 1     |
  | status.availableReplicas                    | equals    | 1     |
  | metadata.labels."app.kubernetes.io/version" | equals    | 1.27  |
```

## Polling for eventually-consistent state

`Deployment`/`Service` are always discovered *after* an `--atomic` `helm
upgrade`, so they're already stable — a one-shot `get` is safe. A `Pod`
has no such guarantee (it can be `Pending` for a real, variable time).
`When I poll Pod known as "<Alias>" every "<interval>" for up to
"<timeout>" until:` (plus `poll logs for Pod`/`poll events for Pod`
siblings) re-runs a real command every interval until:
- every `pass`-`OUTCOME` row holds → **success**
- any `fail`-`OUTCOME` row holds → **immediate failure**
- the timeout elapses → **failure**, with the last real observed state

```gherkin
When I poll Pod known as "<NginxPod>" every "3s" for up to "30s" until:
  | KEY                                              | CONDITION | VALUE            | OUTCOME |
  | status.phase                                     | equals    | Running          | pass    |
  | status.containerStatuses[0].ready                | equals    | true             | pass    |
  | status.containerStatuses[0].state.waiting.reason | equals    | CrashLoopBackOff | fail    |
```
There's also `When I attempt to poll Pod ...` for negative tests, and
`poll logs`/`poll events` use `SOURCE|CONDITION|VALUE|OUTCOME` (raw text)
instead of `KEY` (JMESPath) rows:
```gherkin
When I poll logs for Pod known as "<NginxPod>" every "3s" for up to "15s" until:
  | SOURCE | CONDITION | VALUE                                       | OUTCOME |
  | STDOUT | contains  | Configuration complete; ready for start up | pass    |
```

**In practice, fast-failing on a bad image**
(`features/k8s/kubernetes.feature`, deliberately installed *without*
`--atomic` so the bad state can be observed instead of auto-rolled-back):
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
Because a real bad state can genuinely be observed as more than one real
message across ticks, pair a fast-fail poll with `it should have failed
with either:` (matches if the error includes *any* listed candidate),
not the single-message form.

## Known gotcha: cucumber-js's own step timeout

cucumber-js's default step timeout is **5000ms** — shorter than a
legitimate real poll used in this suite (up to 2 minutes). This is
already handled globally (`support/hooks.ts` raises it via
`setDefaultTimeout`) — if you add a new poll with a longer real timeout
than anything existing, check that value is still comfortably above your
new longest real wait; don't assume it's covered forever.

## A Service can't route to a Pod it just excluded

Once a Pod is confirmed NotReady (via a Pod-status poll), it has been
removed from its Service's endpoints entirely — a request routed
*through the Service* has no backend left to reach and fails to
connect, it does not return the app's real error status. Don't write a
follow-up `RestEndpoint` request expecting a real error status code from
an already-NotReady Pod's Service; assert the readiness state directly
instead, the way `features/rest/health.feature`'s readiness-flip
scenario does.
