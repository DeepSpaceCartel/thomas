# BDD conventions

This is how every `.feature` file in Thomas is written. See
[Resources](../reference/RESOURCES.md) for the four resource-only
construction types (`Directory`/`File`/`URL`/`OCI Artifact`), and
[Helm](../reference/HELM.md), [Kubernetes](../reference/KUBECTL.md), and
[REST](../reference/REST.md) for the per-tool step catalogs this
convention underlies.

## Define, then act

Define an object with a `Given` step — construction and validation only,
never a mutating command — then use a separate `When` step for the
operation that actually runs something real:

```gherkin
Given Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "https://charts.bitnami.com/bitnami"
When I add Helm Repo known as "<BitnamiHelmRepo>"
Then the command exited with 0
```

## Resource Substitution

A table cell written as `<SomeResource>` (starts with `<`, ends with `>`)
is real substitution against a previously-registered resource — not a
Cucumber naming convention. Referencing one that was never defined
fails loudly (e.g. `No Resource registered as "<Resource>"` for the four
Resource types below), it never silently falls back to treating the
text as a literal value. Resource substitution works in table
`PROPERTY`/`VALUE` cells, request paths, and captured response values
alike.

Most types resolve to a plain **string** (a path, URL, ref). Two types
resolve to the real **object** instead, because a string would have
already lost structure the type needs later: `HelmRelease.chart`
resolves to the real Chart (its CLI args depend on the chart's source
kind), and `RestEndpoint.service` resolves to the real `Service` (its
base URL needs the object's real name/namespace).

```gherkin
Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
```

`<NginxChartDirectory>` resolves to the real registered `Directory`'s
`path` before the Chart is constructed — a plain string, per the first
resolution kind above. See [Resources](../reference/RESOURCES.md) for
the per-type construction reference (`Directory`/`File`/`URL`/`OCI
Artifact`).

## Table shapes

Six different header vocabularies, each for a different purpose — don't
mix them up:

### Construction

Used by `Given <Type> known as "<Alias>":` — fields to construct an
object from. For every type with a small, fixed field set (every
resource-only type, Chart, Repository, Release, HTTP/HTTPS Endpoint), a
oneline step also exists and is what almost every real scenario uses
today — the table form is still the real base shape underneath:

=== "Short"

    ```gherkin
    Given Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "thomas-nginx-release" in "thomas-helm-test"
    ```

=== "Full"

    ```gherkin
    Given Helm Release known as "<NginxRelease>":
      | PROPERTY  | VALUE                 |
      | chart     | <NginxHelmChart>      |
      | name      | thomas-nginx-release  |
      | namespace | thomas-helm-test      |
    ```

The table form stays the necessary one for any type with an
*open-ended* field set — `Deployment`/`Service`/`Pod`/`ConfigMap`/
`ReplicaSet`/`Secret`'s label selectors — which deliberately has no
oneline form for the same reason it has no closed field list (see
[Kubernetes: Discovery](../reference/KUBECTL.md#discovery)).

**Negative-path tests** (passing an unknown/missing field, which a
fixed-arity oneline structurally can't express) no longer need a live
table either — a real, open-ended **Payload accumulator** builds the
same field set line by line instead, then hands it to the exact same
real construction function the table form uses:

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

`Given {string} field {string} is {string}` accumulates into a named
payload (same real "table is sugar over a plain-fields core" shape as
the [Request Building](#request-building) accumulator below, just for
a 2-column `PROPERTY|VALUE` payload instead of a 3-column request row);
`When I attempt to define <Type> known as {string} using {string}`
(one real registration per type, in that type's own step file) reads
the accumulated fields and calls the exact same real `xFromFields`
function the table form already uses — not a second construction
implementation. One real type (`Secret`) has a genuine bounded retry
inside its real construction (a cert-manager async-issuance race) —
the payload form goes through that identical retry too, since it calls
the same real function, just fed differently.

### Command Flags

Used by `When I <verb> ... with:` — CLI flags → argv. Blank
`OPTION` = positional arg. `VALUE` of `True`/`False` = a boolean
flag present with no value, or omitted entirely.

```gherkin
When I upgrade Helm Release known as "<NginxRelease>" with:
  | OPTION             | VALUE |
  | --install          | True  |
  | --atomic           | True  |
  | --create-namespace | True  |
```

### Structured Data Assertions

Used by `... has:` / `the command result data has:` — assertions
against parsed structured data (JMESPath `KEY`, see [JMESPath
Queries](#jmespath-queries) below).

```gherkin
Then the command result data has:
  | KEY          | CONDITION | VALUE |
  | replicaCount | equals    | 1     |
```

### Raw Output Assertions

Used by `the command exited with {int}:` — assertions against a
command's raw `STDOUT`/`STDERR` text.

```gherkin
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                       |
  | STDOUT | contains  | Successfully packaged chart |
```

### Polling Conditions

Used by `When I poll ... until:` — same condition-checking, plus a
polarity: `OUTCOME` is `pass` (must hold to succeed) or `fail`
(holding means stop and fail immediately).

```gherkin
When I poll Pod known as "<NginxPod>" every "3s" for up to "30s" until:
  | KEY                                              | CONDITION | VALUE            | OUTCOME |
  | status.phase                                     | equals    | Running          | pass    |
  | status.containerStatuses[0].state.waiting.reason | equals    | CrashLoopBackOff | fail    |
```

### Request Building

Used by `When I send a {httpMethod} request to Endpoint ... with:`
— builds a real HTTP/HTTPS request, see [REST](../reference/REST.md).

```gherkin
When I send a POST request to Endpoint known as "<NotesApi>" path "/notes/" with:
  | TYPE  | KEY   | VALUE      |
  | FIELD | title | Groceries  |
  | FIELD | body  | Milk, eggs |
```

A `with header {string} {string}`/`with query {string} {string}`/
`with basic auth {string} {string}` oneline covers the single-row
case. For 2+ rows, accumulate the request across several lines
instead of a table — same real predicate-accumulation shape as
[progressive object discovery](#progressive-object-discovery), just
for a request instead of a k8s selector:

```gherkin
Given "<NewNote>" has FIELD "title" "Groceries"
And "<NewNote>" has FIELD "body" "Milk, eggs"
When I send "<NewNote>" as POST to Endpoint known as "<NotesApi>" path "/notes/"
```

`{word}` is the row's real `TYPE` (`HEADER`/`QUERY`/`FIELD`/`BODY`/
`FORM`/`FILE`/`BASIC_AUTH`) — one generic registration, not one per
type. A `BODY` row's blank `KEY` table cell becomes an empty-string
`""` argument here, not a special case.

### Exit Code and Output

```gherkin
Then the command exited with {int}
Then the command exited with {int}:
Then the command succeeds                 # plain-English alias for "exited with 0" specifically
```

Type-agnostic — reads only `World.lastCommandResult`, so every domain
reuses it unchanged.

```gherkin
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                       |
  | STDOUT | contains  | Successfully packaged chart |
```

### Structured Result Data

```gherkin
Then the command result data has:
```

JMESPath assertions against parsed `STDOUT` — see [JMESPath
Queries](#jmespath-queries) below.

```gherkin
Then the command result data has:
  | KEY          | CONDITION | VALUE |
  | replicaCount | equals    | 1     |
```

Its oneline sibling (`the command result has {string} {condition}
{word}`, [Table shapes](#table-shapes) above) has two further siblings:
a `{string}` (quoted) value position for one containing a space —
`Then the command result has "body" is "Milk, eggs"` — and a
value-less form for `exists`/`undefined` specifically (the only two
conditions that ignore their value): `Then the command result has
"username" exists`. Using a value-less form with any other condition
fails loudly rather than silently comparing against `""`.

### Failure Messages

```gherkin
Then it should have failed with {string}
Then it should have failed with either:
```

Both are type-agnostic, reading only `World.lastError` — set by any
`I attempt to ...` step. The `either:` form takes a single-column
`| MESSAGE |` table and passes if the real error includes *any* one
candidate — useful when a failure can genuinely land on more than one
real message across ticks:

```gherkin
Then it should have failed with either:
  | MESSAGE          |
  | ErrImagePull      |
  | ImagePullBackOff  |
```

(see [Kubernetes: poll a Pod](../reference/KUBECTL.md#poll-a-pod))

## JMESPath Queries

[Assertion tables](#table-shapes) resolve `KEY` with
[JMESPath](https://jmespath.org/) against the parsed data. Parsing
always goes through `yaml.load` on the raw text — JSON is valid YAML,
so the exact same code path handles both `helm ... -o yaml` output and
HTTP JSON response bodies with zero special-casing.

### Flat Key Lookup

```gherkin
Then the command result data has:
  | KEY        | CONDITION | VALUE |
  | apiVersion | equals    | v2    |
```

### Array Projection

Useful against list-shaped output like `helm repo list -o yaml` or
`helm list -o yaml`:

```gherkin
Then the command result data has:
  | KEY      | CONDITION | VALUE   |
  | [*].name | equals    | bitnami |
```

### Quoted Identifiers

`metadata.labels."app.kubernetes.io/version"` — the quotes are needed
because JMESPath's bare-identifier syntax doesn't allow `.` and `/`
inside a key name, and Kubernetes labels are full of both:

```gherkin
Then the command result data has:
  | KEY                                         | CONDITION | VALUE |
  | metadata.labels."app.kubernetes.io/version" | equals    | 1.27  |
```

### Existential vs. Universal Matching

When `KEY` resolves to an array, a condition passes if **any** element
matches — except `not_equals`, which is **universal** (passes only if
**no** element matches, the natural reading of a negated condition):

```gherkin
# passes if "thomas-remove-example" is NOT in the list, at all
Then the command result data has:
  | KEY      | CONDITION  | VALUE                  |
  | [*].name | not_equals | thomas-remove-example |
```

## Conditions

### Equals

`equals` (aliases: `=`, `==`, `is`) Exact match.

```gherkin
| KEY        | CONDITION | VALUE |
| apiVersion | equals    | v2    |
```

### Contains

`contains` Substring/element match.

```gherkin
| KEY         | CONDITION | VALUE |
| description | contains  | nginx |
```

### Case-Insensitive Contains

`icontains` Case-insensitive `contains`.

```gherkin
| KEY         | CONDITION | VALUE |
| description | icontains | NGINX |
```

### Undefined

`undefined` The field is genuinely absent — not `null`, not `false`, not `""`, actually missing from the parsed data.

```gherkin
| KEY           | CONDITION | VALUE |
| password_hash | undefined |       |
```

### Exists

`exists`
:   The literal inverse of `undefined` — the field is genuinely present.
    ```gherkin
    | KEY      | CONDITION | VALUE |
    | username | exists    |       |
    ```

### Not Equals

`not_equals` (aliases: `!=`, `is not`) Only really useful against an array — "this value isn't in the
list" (see [existential vs. universal
matching](#existential-vs-universal-matching) above).

```gherkin
| KEY      | CONDITION  | VALUE                  |
| [*].name | not_equals | thomas-remove-example |
```

### Greater Than

`gt` (alias: `>`) Numeric comparison — both sides parsed with `Number()`, so a
non-numeric value on either side fails loudly with a clear reason
rather than silently comparing `NaN`s.

```gherkin
| KEY           | CONDITION | VALUE |
| spec.replicas | gt        | 0     |
```

### Greater Or Equal

`gte` (alias: `>=`) Same numeric comparison as [Greater Than](#greater-than), inclusive.

```gherkin
| KEY                  | CONDITION | VALUE |
| status.readyReplicas | gte       | 1     |
```

### Less Than

`lt` (alias: `<`)Same numeric comparison as [Greater Than](#greater-than), reversed.

```gherkin
| KEY                  | CONDITION | VALUE |
| status.readyReplicas | lt        | 10    |
```

### Less Or Equal

`lte` (alias: `<=`) Same numeric comparison as [Greater Than](#greater-than), reversed
and inclusive.

```gherkin
| KEY                  | CONDITION | VALUE |
| status.readyReplicas | lte       | 10    |
```

The symbol forms (`>` / `>=` / `<` / `<=` / `=` / `==` / `!=`) and the
plain-English `is` / `is not` are all real aliases, not a second
vocabulary — normalized to their word form before checking, so they
work anywhere a condition appears, table cells and the oneline forms
alike:
```gherkin
Then the command result has "status.readyReplicas" gte 1
Then Deployment "<X>" has "status.readyReplicas" >= 1
Then the command result has "info.status" is deployed
```

## Object-flavored assertions

A `Then` step named after the object instead of "the command result" —
still only ever reads the same captured command output as the generic
forms above, populated by whatever real `When` ran immediately before
it:

```gherkin
When I get Deployment "<X>" as JSON
Then Deployment "<X>" has "status.readyReplicas" >= 1

When I get status of Helm Release "<X>" as YAML
Then Helm Release "<X>" is "deployed"
```

The real value beyond readability: both first check the alias is a
genuinely registered object of that kind before comparing anything,
catching a copy-paste mismatch a generic assertion wouldn't.

## Progressive object discovery

Kubernetes objects (`Deployment`/`Service`/`Pod`/`ConfigMap`/
`ReplicaSet`/`Secret`) can also be discovered a line at a time instead
of via one `PROPERTY|VALUE` table — the same real, one-time `kubectl
get` underneath, just deferred until the object is actually used, since
with this style the full selector isn't known until the last line runs:

```gherkin
Given Deployment "<X>"
And "<X>" namespace is "dev"
And "<X>" label "app.kubernetes.io/instance" is "nginx-release"
```

## Dynamic value capture

A server-generated value (a created resource's real `id`) is only known
*after* a response comes back:

=== "Flat key"

    ```gherkin
    When I send a POST request to Endpoint known as "<Api>" path "/notes/" with:
      | TYPE  | KEY   | VALUE |
      | FIELD | title | Hi    |
    Given the value at "id" from the last response is known as "<NoteId>"
    When I send a GET request to Endpoint known as "<Api>" path "/notes/<NoteId>"
    ```

=== "Array index"

    ```gherkin
    Given the value at "response_types_supported[0]" from the last response is known as "<GrantType>"
    ```

    Indexing works the same as in [Array Projection](#array-projection)
    above — the underlying `query()` function is the exact same real
    JMESPath call in both cases, only the data source (a captured HTTP
    response body vs. `the command result data has:`'s parsed
    `STDOUT`) differs. A genuinely nested path (`user.profile.id`) or a
    [quoted identifier](#quoted-identifiers) works identically too —
    this project's REST fixture's JSON responses just don't happen to
    nest that deeply today; the real proof against nested data is the
    `metadata.labels."..."` example above, parsed by the same code path.

This is a deliberately separate, narrower mechanism from alias
resolution above — it resolves `<...>` **embedded** anywhere in a
string (a path, or a header value like `Bearer <Token>`), not just when
the whole cell is one alias reference, and it does not run inside
`KEY|CONDITION|VALUE` assertion tables. Side by side:

```gherkin
# Alias resolution - whole cell, resolved when the object is
# constructed, from a name registered by an earlier Given step.
And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"

# Captured-value substitution - embedded anywhere in a string, resolved
# when the request/path is built, from a value only known after a real
# response came back. Never runs inside a KEY|CONDITION|VALUE table.
When I send a GET request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
```

See [REST: capturing a dynamic
value](../reference/REST.md#capturing-a-dynamic-value-for-later-use) for more.

## Keep scenarios self-contained

Every scenario that mutates real state (repo add/remove, Helm Release
install/uninstall) redeclares its own preamble and cleans up after
itself — no cross-scenario or cross-file shared state, and no assuming
another scenario ran first.

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
