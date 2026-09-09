# BDD conventions

This is how every `.feature` file in Thomas is written. See
[Helm](HELM.md), [Kubernetes](KUBECTL.md), and [REST](REST.md) for the
per-tool step catalogs this convention underlies — each documents its
own alias types' construction shape alongside the steps that use them.

## Define, then act

Define an object with a `Given` step — construction and validation only,
never a mutating command — then use a separate `When` step for the
operation that actually runs something real:

```gherkin
Given Helm Repo known as "<BitnamiHelmRepo>":
  | PROPERTY | VALUE                              |
  | name     | bitnami                            |
  | url      | https://charts.bitnami.com/bitnami |
When I add Helm Repo known as "<BitnamiHelmRepo>" with:
  | OPTION | VALUE |
Then the command exited with 0
```

## Alias Substitution

A table cell written as `<SomeAlias>` (starts with `<`, ends with `>`)
is real substitution against a previously-registered alias — not a
Cucumber naming convention. Referencing an alias that was never defined
fails loudly (`No Alias registered as "<Alias>"`), it never silently
falls back to treating the text as a literal value. Alias substitution
works in table `PROPERTY`/`VALUE` cells, request paths, and captured
response values alike.

Most alias types resolve to a plain **string** (a path, URL, ref). Two
types resolve to the real **object** instead, because a string would
have already lost structure the type needs later: `HelmRelease.chart`
resolves to the real `HelmChart` (its CLI args depend on the chart's
source kind), and `RestEndpoint.service` resolves to the real `Service`
(its base URL needs the object's real name/namespace).

## Table shapes

Six different header vocabularies, each for a different purpose — don't
mix them up:

`PROPERTY | VALUE`
:   Used by `Given <Type> known as "<Alias>":` — fields to construct an
    object from.

`OPTION | VALUE`
:   Used by `When I <verb> ... with:` — CLI flags → argv. Blank
    `OPTION` = positional arg. `VALUE` of `True`/`False` = a boolean
    flag present with no value, or omitted entirely.

`KEY | CONDITION | VALUE`
:   Used by `... has:` / `the command result data has:` — assertions
    against parsed structured data (JMESPath `KEY`).

`SOURCE | CONDITION | VALUE`
:   Used by `the command exited with {int}:` — assertions against a
    command's raw `STDOUT`/`STDERR` text.

`KEY | CONDITION | VALUE | OUTCOME`
:   Used by `When I poll ... until:` — same condition-checking, plus a
    polarity: `OUTCOME` is `pass` (must hold to succeed) or `fail`
    (holding means stop and fail immediately).

`TYPE | KEY | VALUE`
:   Used by `When I send a {word} request to RestEndpoint ... with:` —
    builds a real HTTP request, see [REST](REST.md).

`the command exited with {int}[:]`, `the command result data has:`, and
`it should have failed with {string}`/`with either:` are type-agnostic —
they only ever read the last command result or error, so every `When`
step across every object type reuses the same `Then`s. `it should have
failed with either:` takes a single-column `| MESSAGE |` table and
passes if the real error message includes *any* one of the listed
candidates — useful when a failure can genuinely land on more than one
real message (see [Kubernetes: poll a Pod](KUBECTL.md#poll-a-pod)).

## JMESPath Queries

`KEY | CONDITION | VALUE` tables resolve `KEY` with
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
because JMESPath's bare-identifier syntax doesn't allow `.`/`/` inside a
key name, and Kubernetes labels are full of both:

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
# passes if "sandbox-remove-example" is NOT in the list, at all
Then the command result data has:
  | KEY      | CONDITION  | VALUE                  |
  | [*].name | not_equals | sandbox-remove-example |
```

## Conditions

`equals`
:   Exact match.
    ```gherkin
    | KEY        | CONDITION | VALUE |
    | apiVersion | equals    | v2    |
    ```

`contains`
:   Substring/element match.
    ```gherkin
    | KEY         | CONDITION | VALUE |
    | description | contains  | nginx |
    ```

`icontains`
:   Case-insensitive `contains`.
    ```gherkin
    | KEY         | CONDITION | VALUE |
    | description | icontains | NGINX |
    ```

`undefined`
:   The field is genuinely absent — not `null`, not `false`, not `""`,
    actually missing from the parsed data.
    ```gherkin
    | KEY           | CONDITION | VALUE |
    | password_hash | undefined |       |
    ```

`not_equals`
:   Only really useful against an array — "this value isn't in the
    list" (see [existential vs. universal
    matching](#existential-vs-universal-matching) above).
    ```gherkin
    | KEY      | CONDITION  | VALUE                  |
    | [*].name | not_equals | sandbox-remove-example |
    ```

## Dynamic value capture

A server-generated value (a created resource's real `id`) is only known
*after* a response comes back:

```gherkin
When I send a POST request to RestEndpoint known as "<Api>" path "/notes/" with:
  | TYPE  | KEY   | VALUE |
  | FIELD | title | Hi    |
Given the value at "id" from the last response is known as "<NoteId>"
When I send a GET request to RestEndpoint known as "<Api>" path "/notes/<NoteId>"
```

This is a deliberately separate, narrower mechanism from alias
resolution above — it resolves `<...>` **embedded** anywhere in a
string (a path, or a header value like `Bearer <Token>`), not just when
the whole cell is one alias reference, and it does not run inside
`KEY|CONDITION|VALUE` assertion tables. See [REST: capturing a dynamic
value](REST.md#capturing-a-dynamic-value-for-later-use) for more.

## Keep scenarios self-contained

Every scenario that mutates real state (repo add/remove, HelmRelease
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
