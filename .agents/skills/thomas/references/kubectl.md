# kubectl steps

Real `kubectl`-observed cluster state. See [`../SKILL.md`](../SKILL.md)
first for the general pattern this extends.

## Discovery by label selector, not by name

`Deployment`/`Service`/`Pod`/`ConfigMap`/`ReplicaSet`/`Secret` are
discovered by real Kubernetes labels, not a guessed/computed resource
name:

```gherkin
Given Deployment known as "<NginxDeployment>":
  | PROPERTY                   | VALUE                     |
  | namespace                  | thomas-helm-test        |
  | app.kubernetes.io/name     | test-nginx                |
  | app.kubernetes.io/instance | thomas-nginx-k8s-release |
```
`namespace` is the one recognized non-label field; every other row is an
arbitrary label key/value used to build a `-l` selector — there is no
closed field list to validate against, since a real chart's label set
can't be enumerated in advance, and (unlike every construction type in
[`helm.md`](helm.md)) there is deliberately no *fixed-arity oneline*
construction form here — see
[`extending.md`](extending.md#oneline-construction-given-steps) for why
an open-ended label set can't be squeezed into one, and why inferring
labels from the Chart instead of a real selector was considered and
rejected. There is a second, real construction style for when a table
is more than this needs — see [Progressive
discovery](#progressive-discovery) below; both resolve the same real
way, an object just built one line at a time isn't resolved until
actually used. Discovery requires the selector to match **exactly one**
real object — 0 or 2+ matches is a loud error (`Expected exactly one
<kind> matching ...`), never a silent pick-first. The table form runs
its real, read-only `kubectl get` at `Given` time. Each kind's
`Given`/`I attempt to define ...` pair is a literal, per-kind
registration (a single `{word} known as ...:` step would collide with
every other single-word resource type — `Directory`, `File`, `URL`,
`Secret` — already registered the same shape). `Secret` discovery
retries for a few real seconds before giving up — unlike the others
here, it's typically created by a controller (cert-manager) reacting to
some other resource, asynchronously and outside `--atomic`'s wait, so a
single immediate lookup can genuinely race it (see [TLS certificate
inspection](#tls-certificate-inspection) below).

!!! warning "ReplicaSet is only safe against a release installed once"
    A Deployment keeps old ReplicaSets around across revisions
    (`revisionHistoryLimit`), and every one of them carries the same
    `app.kubernetes.io/name`/`instance` labels as the Deployment itself
    — so discovering a `ReplicaSet` against a release upgraded or rolled
    back more than once genuinely matches more than one object and
    fails the "exactly one" check above. Only use it against a
    single-revision release.

## Progressive discovery

A second, additive construction style — the same real, one-time
`kubectl get` as the table form, just spread over several `Given` lines
instead of one table, deferred until the object is actually used:

```gherkin
Given Deployment "<NginxDeployment>"
And "<NginxDeployment>" namespace is "dev"
And "<NginxDeployment>" label "app.kubernetes.io/instance" is "nginx-release"
```

`Given {word} {string}` (validated against the same kind list as
everything else here) registers an empty pending selector; the two `And`
lines add to it. **No real command runs at this point** — with this
style the full selector genuinely isn't known until the last `And` line,
so the real `kubectl get` happens lazily, the first time the alias is
actually used by a `When`/`Then` step below, with the exact same "expected
exactly one match" error behavior as the table form. The table form
(`Given <Kind> known as "<Alias>":`) is unchanged and still resolves
eagerly — pick whichever reads better for a given number of predicates;
a table is still the better fit for many labels at once.

## Querying a discovered object

```gherkin
When I get {word} known as "<Alias>"                          # kubectl get <kind> <name> -n <namespace>
When I get {word} known as "<Alias>" with:
When I get {word} "<Alias>" with {flags}
When I get {word} "<Alias>" as {outputFormat}                  # shorthand for --output json/yaml specifically
When I get events for {word} known as "<Alias>"                # kubectl get events --field-selector involvedObject.name=...
When I get events for {word} known as "<Alias>" with:
When I get events for {word} "<Alias>" with {flags}
When I get logs for {word} known as "<Alias>"                  # kubectl logs <kind>/<name>
When I get logs for {word} known as "<Alias>" with:
When I get logs for {word} "<Alias>" with {flags}
```
`{word}` is the kind (`Deployment`, `Service`, `Pod`, `ConfigMap`,
`ReplicaSet`, `Secret`) — one generic registration per action, driven by
a `KIND_REGISTRY` map in `kubernetes.step.ts`, not one registration per
kind (adding a new kind needs only a new `World` map field + registry
entry, no new step text). `Service`/`ConfigMap`/`Secret` support
`get`/`get events` (no `logs` — none of them have any); `Pod` supports
all three, plus the polling steps below.

There's also a generic delete, for the rare kind Helm itself doesn't
own and so won't clean up on `uninstall` (a cert-manager `Secret` is the
one real example so far):
```gherkin
When I delete {word} known as "<Alias>"                       # kubectl delete <kind> <name> -n <namespace>
```

**In practice** (`features/k8s/kubernetes-short.feature`; see
`kubernetes-full.feature` for the same flow in full table syntax):
```gherkin
When I get Deployment "<NginxDeployment>" with --output json
Then the command result has "status.readyReplicas" gte 1
Then the command result data has:
  | KEY                                         | CONDITION | VALUE |
  | status.readyReplicas                        | equals    | 1     |
  | status.availableReplicas                    | equals    | 1     |
  | metadata.labels."app.kubernetes.io/version" | equals    | 1.27  |
```

**In practice, the object-flavored/progressive/`as JSON` combination**
(`features/quickstart.feature`):
```gherkin
Given Deployment "<NginxDeployment>"
And "<NginxDeployment>" namespace is "dev"
And "<NginxDeployment>" label "app.kubernetes.io/instance" is "nginx-release"
When I get Deployment "<NginxDeployment>" as JSON
Then Deployment "<NginxDeployment>" has "status.readyReplicas" >= 1
```
`Then {word} "<Alias>" has "<key>" <condition> <value>` is a sibling of
`the command result has ...` named after the object — still only ever
reads `lastCommandResult` (populated by the `When I get ...` line right
above it), plus a real check that `"<NginxDeployment>"` is a genuinely
registered `Deployment` first, catching a copy-paste alias/kind mismatch
before comparing anything. See
[`extending.md`](extending.md#object-flavored-then-assertions) for the
full design and how to add a similar one for a new domain.

For events/logs, prefer the table-less form when there's nothing to
pass, and pair with a poll (below) rather than a one-shot `get` when the
assertion needs to be on real content, not just exit code 0:
```gherkin
When I get events for Deployment known as "<NginxDeployment>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                 |
  | STDOUT | contains  | Scaled up replica set |
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
instead of `KEY` (JMESPath) rows. Polling has no oneline single-condition
form — every real poll in this suite checks 2+ conditions together:
```gherkin
When I poll logs for Pod known as "<NginxPod>" every "3s" for up to "15s" until:
  | SOURCE | CONDITION | VALUE                                       | OUTCOME |
  | STDOUT | contains  | Configuration complete; ready for start up | pass    |
```

**In practice, fast-failing on a bad image**
(`features/k8s/kubernetes-full.feature` — this scenario tests real error
handling, not construction/action styling, so it only exists in the
full-table-syntax file; deliberately installed *without* `--atomic` so
the bad state can be observed instead of auto-rolled-back):
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

### Polling structured events

`poll events for Pod` (above) only ever substring-matches the whole raw
`kubectl get events` text — it can't distinguish a `Reason` value from a
`Message` value as separate fields, only as accidentally-adjacent
substrings of the same blob. `When I poll structured events for Pod
known as "<Alias>" every "<interval>" for up to "<timeout>" until:`
reuses the same `pollStructured` mechanism `poll Pod` already uses,
fed from `kubectl get events -o json` instead of `kubectl get pod -o
json` — real per-field `KEY|CONDITION|VALUE|OUTCOME` rows against a real
`v1.Event`'s `reason`/`message`, via `items[*].reason`/`items[*].message`
array projection (an events list, not a single object):

```gherkin
When I poll structured events for Pod known as "<EventsPod>" every "3s" for up to "60s" until:
  | KEY              | CONDITION | VALUE                | OUTCOME |
  | items[*].reason   | contains  | Unhealthy            | pass    |
  | items[*].message  | contains  | Startup probe failed | pass    |
```

Additive, not a replacement — the raw-text `poll events for Pod ...`
step above is untouched, still the right tool when a real check only
needs "does this text show up somewhere," not two separate fields.
`features/k8s/events-{short,full}.feature` exercises this against a
real, transient startup-probe failure: `charts/test-rest-api` installed
*without* `--atomic` (same fast-fail technique as the bad-image example
above) genuinely produces a real `Reason=Unhealthy` event with a real
`Message` containing "Startup probe failed" during its own uncached
`pip install` window, confirmed live via `kubectl get events -o json`
before writing the scenario — then a real recovery once the app finishes
starting. `events-short.feature` deliberately uses a distinct release
name from `events-full.feature`'s own — confirmed for real that sharing
one races a non-atomic install's Pod against the previous scenario's
still-terminating one, genuinely matching 2 real Pods on the same label
selector.

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
follow-up HTTP/HTTPS Endpoint request expecting a real error status code from
an already-NotReady Pod's Service; assert the readiness state directly
instead, the way `features/rest/health-{short,full}.feature`'s
readiness-flip scenario does.

## Exec into a Pod

```gherkin
When I exec "<command>" in Pod known as "<Alias>"
```
For checks `get`/`logs`/`events` can't answer from the outside — a
mounted file's real content, an env var, whether a process is actually
running. Runs a real `kubectl exec <pod> -n <namespace> -- sh -c
"<command>"`, so pipes/redirects in `<command>` work unmodified. Lands
in `lastCommandResult` like every other command — the existing `the
command exited with {int}[:]` steps assert on it unchanged, zero new
vocabulary:
```gherkin
When I exec "cat /etc/nginx/conf.d/default.conf" in Pod known as "<NginxPod>"
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE        |
  | STDOUT | contains  | location / { |
```
(`features/k8s/kubernetes-short.feature`/`kubernetes-full.feature` — this
step takes a single real string, not an `OPTION|VALUE` table, so it's
identical in both files)

## RBAC: checking a Pod's real permissions

```gherkin
When I check if Pod known as "<Alias>" can "<verb>" "<resource>"
```
A different axis from everything above — permissions, not state.
Fetches the Pod's real `spec.serviceAccountName` fresh (not cached at
discovery time), then runs a real `kubectl auth can-i <verb> <resource>
--as=system:serviceaccount:<namespace>:<serviceAccount> -n <namespace>`
— itself the real assertion mechanism (exits 0 allowed, 1 denied), so
`the command exited with {int}` covers it, zero new vocabulary:
```gherkin
When I check if Pod known as "<NginxPod>" can "create" "deployments"
Then the command exited with 1
```
This Pod's real ServiceAccount is the namespace's `default` (the chart
declares none), which genuinely cannot create Deployments under
standard RBAC — a real, true assertion (`features/k8s/kubernetes-short.feature`/
`kubernetes-full.feature` — again identical in both, no `OPTION|VALUE`
table involved).

## TLS certificate inspection

```gherkin
When I inspect the certificate in Secret known as "<Alias>"
```
Extracts `data."tls.crt"` from a real `kubernetes.io/tls` Secret,
base64-decodes it to a real temp file, and runs a real `openssl x509
-in <path> -noout -subject -enddate -ext subjectAltName` against it.
Lands in `lastCommandResult` — `the command exited with {int}:` plus
`SOURCE|CONDITION|VALUE` against the real subject/expiry/SANs, again
zero new vocabulary:
```gherkin
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
(`features/k8s/tls-{short,full}.feature`, against the `charts/test-tls-demo/` fixture —
see [`helm.md`](helm.md)'s Fixture charts section for why that chart
deliberately uses a self-signed `Issuer` rather than this cluster's real
one.) `helm uninstall` doesn't remove this Secret (cert-manager creates
it with no `ownerReference` back to anything Helm tracks) — clean it up
explicitly with `When I delete Secret known as "<Alias>"`.
