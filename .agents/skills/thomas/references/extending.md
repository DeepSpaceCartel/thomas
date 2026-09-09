# Extending Thomas

This is how every `.feature` file in Thomas is written, and how to add
to that vocabulary safely — not generic Cucumber advice, this project's
own convention, evolved over many rounds of review. Follow it exactly;
don't improvise a new shape when an existing one already fits. If you
just want to *use* an existing step, see
[`using-steps.md`](using-steps.md) instead — this reference is for
changing Thomas itself.

## Every alias type is one `Map<string, T>` on `World`

`features/support/world.ts` holds one `Map<string, T>` field per alias
type (`charts`, `repos`, `helmReleases`, `directories`, `files`, `urls`,
`ociArtifacts`, `deployments`, `services`, `pods`, `configMaps`,
`replicaSets`, `secrets`, `restEndpoints`),
keyed by the literal alias string *including* the `<...>` brackets, plus
`capturedValues: Map<string, string>` for dynamic capture (see below). A
new alias type = one new file under `support/<domain>/`, one new `Map`
field on `World`, and a `Given`/`When I attempt to define ...` pair in
the matching `step_definitions/<domain>/*.step.ts` file, following an
existing type's shape — `Directory`, `HelmChart`, `HelmRelease` are good
templates, roughly in increasing order of how special their resolution
is. `step_definitions/` mirrors `support/`'s own domain split
(`resources/`, `helm/`, `k8s/`, `http/`), plus `common.step.ts` at the
top level for genuinely type-agnostic steps.

## Two kinds of alias resolution

Most types resolve to a plain **string** (a path, URL, ref) via the
shared `resolveResource()` (`support/resources/resolve_resource.ts`,
covering the four Resource types — `Directory`/`File`/`URL`/
`OCIArtifact`). A few resolve to the real **object** instead, because a
string would have already lost structure the type needs later:
- `HelmRelease.chart` needs the actual `HelmChart` object (its real CLI args
  depend on `chart.kind`) — resolved via a bespoke
  `(alias) => HelmChart | undefined` callback built in `release.step.ts`
  and passed into `releaseFromTable`.
- `RestEndpoint.service` needs the actual `Service` object (its base URL
  needs the object's real `.name`/`.namespace`) — same shape, via
  `restEndpointFromTable`.

Don't invent a third resolution mechanism — every new type fits one of
these two. `Deployment`/`Service`/`Pod`/`ConfigMap`/`ReplicaSet`/`Secret`
are a different kind of exception entirely: their `Given` performs a
real, read-only `kubectl get` (`support/k8s/discover.ts`'s
`discoverByLabels`) rather than pure construction — justified as the
same category as `Directory`'s real `fs.existsSync` check, not a new
kind of exception. `Secret` additionally retries discovery briefly
(`secretFromTable` in `support/k8s/secret.ts`) — the one kind whose
real object can be created asynchronously by a controller (cert-manager)
reacting to something else, outside Helm's own `--atomic` wait, so a
single immediate `kubectl get` can genuinely race it; every other kind
here is created synchronously enough by `helm upgrade --atomic` itself
that no retry has ever been needed. `RestEndpoint`'s `Given` stays pure
(no live check) — there's no cheap read-only analog to "is this URL
reachable."

Every alias-constructing `*FromTable()` function converts the
DataTable's `PROPERTY|VALUE` hashes into a `Record<string, string>` and
validates against a closed `KNOWN_FIELDS` list, throwing `"<Type> has no
field \"<key>\""` for anything unrecognized — except `discoverByLabels`,
which has no closed list, since a real chart's label set is open-ended
(only `namespace` is a recognized non-label field there).

## Oneline construction `Given` steps

Every type with a closed `KNOWN_FIELDS` list also gets a oneline `Given`
sibling per real field *combination* it's actually constructed with
(one registration per combination — Cucumber Expressions are
fixed-arity, so `HelmChart`'s three real combinations — `chart` alone,
`chart`+`version`, `chart`+`repo`+`version` — are three separate
registrations, not one with optional params). The wording drops `known
as` entirely and uses a bespoke preposition per type, chosen so the
step reads like a natural sentence once the type name is already saying
what kind of resource this is — not a mechanical "with `<field>` ..."
list:

```gherkin
Given Directory "<Alias>" at "<path>"
Given File "<Alias>" at "<path>"
Given URL "<Alias>" at "<value>"
Given OCI Artifact "<Alias>" at "<ref>"
Given Helm Chart "<Alias>" in "<source>"
Given Helm Chart "<Alias>" in "<source>" version "<version>"
Given Helm Chart "<Alias>" in "<source>" repo "<repo>" version "<version>"
Given Helm Repo "<Alias>" named "<name>" at "<url>"
Given Helm Release "<Alias>" of "<chart>" named "<name>" in "<namespace>"
Given HTTP Endpoint "<Alias>" on "<service>" port "<port>"
```

Picking the preposition for a new type: read the sentence aloud with
the type name in place of a variable — "a Directory at a path", "a
Helm Chart in some source", "a Helm Release of some chart, named X, in
some namespace" — and use whatever preposition that sentence actually
wants. There's no fixed vocabulary to pick from; the only rule is it
has to read naturally, not that it match an existing type's choice.

The table-form `*FromTable()` function is kept as a thin wrapper around
a new `*FromFields(fields, ...)` core (e.g. `helmChartFromFields`) that
takes `fields: Record<string, string>` directly — the oneline step
builds `fields` inline and calls the same core, so there's one real
implementation per type, not two. `Directory`/`File`/`URL`/`OCIArtifact`
don't need this split (their `*FromTable` already just does `new
Type(fields)` with no other logic — the oneline handler calls `new
Type({ field: value })` directly).

**Don't** add a oneline form for a type with an open-ended field set
(`Deployment`/`Service`/`Pod`/`ConfigMap`/`ReplicaSet`/`Secret`'s label
selectors) — same reasoning as the `KNOWN_FIELDS` exception above: a
fixed-arity step can't represent an arbitrary label set without either
guessing which 1-2 labels are "the common case" (silently failing a
real 3rd-label scenario) or degrading into a mini-language that's worse
than the table it'd replace. The table form stays these types' only
construction shape. This is also why `Deployment`/`Service`/`Pod`/etc.
never get a short-form discovery step even though a Chart is already
known by the time a Release exists: inferring labels by re-templating
the chart would silently diverge from the real installed object
whenever a scenario applies `--set`/`-f` overrides `helm template`
alone can't see, and can't disambiguate a chart rendering more than one
object of the same kind. Real, observed cluster state via an explicit
selector stays the only construction shape for this family.

The table form always stays too, even for closed-field types — negative-
path tests (unknown/missing field) need it in `-full.feature` files
(`features/resources/*-full.feature`,
`features/helm/helm-repo-validation-full.feature`,
`features/helm/helm-release-validation-full.feature`), which keep the
`DataTable` throughout by design. `-short.feature` files instead reach
for the **Payload accumulator** below, which a fixed-arity oneline can't
express either but doesn't need a live table for — see [Payload
accumulator](#payload-accumulator). This means **every** real
registration needs at least one real caller left in the suite even
after adding a oneline sibling — `npm run test:usage` catches a
registration that's quietly gone unused (this happened for real once:
converting every real call site to the oneline form left the table-form
`Given` completely uncalled, since negative tests go through a
*separate* `When I attempt to define ...` registration, not the plain
`Given`).

## Payload accumulator

A second, additive short form for an **open-ended field set** — same
real need progressive discovery solves for `Deployment`/`Service`/etc.
(a negative-path test needs an unknown/missing field, which a
fixed-arity oneline genuinely can't express), but for closed-`KNOWN_FIELDS`
construction types instead of label-selector discovery. Builds a
`Record<string, string>` across several `Given`/`And` lines instead of
one table, then a `using "<PayloadAlias>"` sibling consumes it and calls
the exact same real `*FromFields`/constructor function the table form
already calls — one implementation, not two:

```gherkin
Given "<BadDirectoryPayload>" field "xxx" is "./charts"
When I attempt to define Directory known as "<BadDirectory>" using "<BadDirectoryPayload>"
Then it should have failed with 'Directory has no field "xxx"'
```

`Given {string} field {string} is {string}` (`common.step.ts`) appends
one `key: value` into `World.pendingPayloads.get(alias) ?? {}`; the
shared `getPendingPayload(world, alias)` throws `No payload registered
as "<alias>"` if never given any. **No real command runs until the
`using "<PayloadAlias>"` step** — same "construction stays lazy until
genuinely needed" discipline as progressive discovery.

Registered for every closed-field construction type, including
`Secret`: its `using "<PayloadAlias>"` calls `secretFromFields`, the
same real bounded-retry function the table form's `secretFromTable`
wraps — **not** `discoverByFields` directly, which is what progressive
discovery uses and would silently bypass the retry. This is the one
real correctness reason `Secret` doesn't get progressive discovery as
its own short form the way `Deployment`/`Service`/`Pod`/etc. do; the
Payload accumulator is the short form that's actually safe for it.

The naming was deliberately picked to avoid a real regexp collision: an
earlier attempt at `Given {string} has property {string} {string}`
turned out genuinely ambiguous against the pre-existing HTTP [request
accumulator](rest.md#building-a-request-with-field-rows-the-request-accumulator)'s
`Given {string} has {word} {string} {string}` — the literal token `"property"` satisfies
`{word}`'s `[^\s]+` regex just as well as `"FIELD"`/`"HEADER"`/etc. does,
so both registrations matched the identical real text. Caught via a real
`npx cucumber-js --dry-run` ("Multiple step definitions match"), not
assumed safe from reading the text alone — `field {string} is {string}`
has no such overlap. Keep this in mind before adding a third `{string}
... {string} {string}`-shaped step: dry-run it against real `.feature`
text before trusting it's unambiguous.

## Short `with <flags>` and oneline condition companions

The same "short sibling, table stays" pattern extends past construction
to two more places:

**Every `When ... with:` (`OPTION|VALUE`) action step** gets a `with
{flags}` sibling. `{flags}` is a Cucumber custom parameter type
(`support/run_command.ts`) matching the rest of the line and tokenizing
it (a small hand-rolled whitespace/quote-aware tokenizer,
`tokenizeFlags` — no new dependency, same convention as `parseDuration`)
straight into the same `string[]` shape `buildArgs()` already produces
from a table:

```gherkin
When I upgrade Helm Release "<Alias>" with --install --atomic --create-namespace
When I get Deployment "<Alias>" with --output json
```

Adding this to a new `... with:` step: register a second `When` for the
same literal prefix, ending in `with {flags}` instead of `with:`, whose
handler is identical except it receives the already-tokenized
`flags: string[]` directly instead of calling `buildArgs(table)` — one
implementation, two entry points, same as the oneline constructors above.

**`the command result data has:` and `the command exited with {int}:`**
each get a single-condition oneline sibling, via a `{condition}`
Cucumber parameter type (`support/assert_condition.ts`'s `CONDITIONS`
list):

```gherkin
Then the command result has "status.readyReplicas" gte 1
Then the command exited with 0 STDOUT contains Succeeded
```

`<value>` is unquoted (`{word}`-shaped) — deliberately, for readability
of the common case; a value containing a space needs the table form.
Polling's `KEY|CONDITION|VALUE|OUTCOME` table doesn't get this treatment
— every real poll in this suite checks 2+ conditions together, so a
single-condition oneline wouldn't fit real usage. Don't build one
speculatively; add it only against a real, concrete single-condition
poll need if one ever shows up.

## Object-flavored `Then` assertions

A further sibling of the oneline condition steps above, named after the
object instead of "the command result" — still only ever reads
`World.lastCommandResult`, populated by whatever real `When` ran
immediately before it. Never a new "act inside `Then`" — the one real
value added is a sanity check that the alias is a genuinely registered
object before comparing anything, catching a copy-paste mismatch:

```gherkin
When I get Deployment "<X>" as JSON
Then Deployment "<X>" has "status.readyReplicas" >= 1

When I get status of Helm Release "<X>" as YAML
Then Helm Release "<X>" is "deployed"
```

The generic k8s one (`k8s/kubernetes.step.ts`) calls `getRegisteredObject`
for the sanity check, then delegates to `common.step.ts`'s exported
`assertResultCondition` — the exact function `the command result has
...` itself calls, not a duplicate. The Helm Release one
(`helm/release.step.ts`) is narrower and fixed-key: `Then Helm Release
{string} is {string}` always means `info.status equals <value>` against
a prior `helm status --output yaml` — the one real idiom nearly every
release-lifecycle scenario in this suite already does, not a general
condition step.

When adding a similar object-flavored `Then` for a new domain: reuse
`assertResultCondition` (or the domain's equivalent shared assertion
function), do the real "is this alias genuinely registered" check first,
and don't invent new condition-checking logic — the value-add is the
sanity check and the readable name, never a second implementation of
"does this hold."

## `as JSON`/`as YAML` output-format shorthand

`--output json`/`--output yaml` and nothing else is the single most
common real `{flags}` payload in this suite — a dedicated shorthand
alongside (not replacing) `with {flags}`, via a `{outputFormat}`
Cucumber parameter type (`support/run_command.ts`, next to `{flags}`)
and a tiny `outputFormatToArgs(format)` helper:

```gherkin
When I get Deployment "<X>" as JSON
When I get status of Helm Release "<X>" as YAML
When I get values for Helm Release "<X>" as YAML
```

Each is a thin sibling of an existing `with {flags}` registration — same
handler body, `outputFormatToArgs(format)` in place of the flags array.
Worth knowing before extending either Helm Release one further: `I get
{word} of Helm Release ...` (verb dispatch — status/history/...) and `I
get {word} for Helm Release ...` (the `helm get <sub>` subcommand —
values/metadata/...) are two different literal patterns (different
prepositions, so Cucumber never confuses them) that happen to read very
similarly — check which mechanism a new case actually needs before
copying either one.

## Progressive object discovery

A second, additive construction style for `Deployment`/`Service`/`Pod`/
`ConfigMap`/`ReplicaSet`/`Secret`, alongside the `PROPERTY|VALUE` table
(which keeps resolving eagerly, unchanged) — builds a real selector
across several `Given` lines instead of one table, for when that reads
more naturally than a table with only 1-2 rows:

```gherkin
Given Deployment "<X>"
And "<X>" namespace is "<Y>"
And "<X>" label "app.kubernetes.io/instance" is "<Z>"
```

`Given {word} {string}` registers an empty `PendingSelector` in
`World.pendingSelectors` (validated against `KIND_REGISTRY` — same
"which kinds exist" source of truth as everything else in
`kubernetes.step.ts`); `Given {string} namespace is {string}` and `Given
{string} label {string} is {string}` add to it. **No real command runs
yet at this point** — deliberately more conservative than even the table
form, since the full selector genuinely isn't known until the last `And`
line runs. The real, one-time `kubectl get` happens lazily, inside
`getRegisteredObject` (the one lookup point every `get`/`get events`/
`get logs`/`delete`/poll/"has" step already goes through) — the first
time the alias is actually used, via `k8s/discover.ts`'s
`discoverByFields` (the same real logic `discoverByLabels` uses, just
callable with a plain object instead of a `DataTable`). Same real error
behavior as the table form ("expected exactly one match", etc.), just
possibly deferred to first use instead of already having run at `Given`
time. All three registered as `Given` (not `When`) — matching this
project's "`Given` only ever constructs" discipline; Gherkin's `And` in
a real `.feature` file reads as whichever keyword the narrative wants,
regardless of how the step was registered.

## The 6 DataTable header vocabularies — extension points, not just reference

Don't mix these up, and don't invent a 7th without a real, concrete need
(each of the 6 that already exist was added because an existing one
genuinely didn't fit, not for variety):

| Headers | Used by | Purpose |
|---|---|---|
| `PROPERTY` \| `VALUE` | `Given <Type> known as "<Alias>":` | Fields to construct an object from |
| `OPTION` \| `VALUE` | `When I <verb> ... with:` | CLI flags → argv (`buildArgs()`, `support/run_command.ts`). Blank `OPTION` = positional. `VALUE` of `True`/`False` = boolean flag present/absent |
| `KEY` \| `CONDITION` \| `VALUE` | `... has:` / `... result data has:` | Assertions against parsed structured data (JMESPath `KEY`) |
| `SOURCE` \| `CONDITION` \| `VALUE` | `the command exited with {int}:` | Assertions against raw `STDOUT`/`STDERR` text |
| `KEY` \| `CONDITION` \| `VALUE` \| `OUTCOME` | `When I poll ... until:` | Same condition-checking, plus polarity: `pass` (must hold to succeed) or `fail` (holding means stop and fail immediately) |
| `TYPE` \| `KEY` \| `VALUE` | `When I send a {httpMethod} request ... with:` | Builds a real HTTP request (`HEADER`/`QUERY`/`FIELD`/`BODY`/`FORM`/`FILE`/`BASIC_AUTH`) |

Two of these six have a real, additive accumulator sibling for an
open-ended row set spread across several `Given`/`And` lines instead of
one table: `PROPERTY|VALUE` via the [Payload
accumulator](#payload-accumulator), `TYPE|KEY|VALUE` via the [request
accumulator](rest.md#building-a-request-with-field-rows-the-request-accumulator).
Both still delegate to the exact same real construction/request-building
function the table form calls.

`OPTION|VALUE`'s `True`/`False` convention is **only** for CLI boolean
flags via `buildArgs()` — do not use capitalized `True`/`False` in a
`KEY|CONDITION|VALUE` table comparing against a real JSON boolean; JSON
`true` stringifies lowercase, and `assertCondition` does plain string
comparison. This exact mistake has already caused one real, confusing
test failure — don't repeat it.

Before adding a 7th vocabulary, check whether an existing one already
fits with a different `KEY`/`SOURCE` value — the polling vocabulary
(`KEY|CONDITION|VALUE|OUTCOME`) is itself a real precedent for "existing
shape + one new column solved this," not a one-off.

## JMESPath `KEY` queries

`KEY|CONDITION|VALUE` tables resolve `KEY` via
[JMESPath](https://jmespath.org/) (`support/query.ts`) against the
parsed data (`yaml.load` on the raw text — JSON is valid YAML, so this
works unmodified for both `helm ... -o yaml` output and HTTP JSON
response bodies). A flat key (`apiVersion`) is a normal lookup; `[*].name`
projects across an array. A quoted identifier
(`metadata.labels."app.kubernetes.io/version"`) accesses a literal key
containing characters JMESPath's bare-identifier syntax doesn't allow.
When `KEY` resolves to an array, the condition is existential by default
(passes if *any* element matches) except `not_equals`, which is
universal (passes only if *no* element matches).

## Conditions

`equals`, `contains`, `icontains` (case-insensitive), `undefined` (field
genuinely absent, not falsy), `exists` (the literal inverse of
`undefined`), `not_equals` (only really useful against an array),
`gt`/`gte`/`lt`/`lte` (numeric comparison — both sides parsed with
`Number()`, the one family of conditions that isn't a plain string
comparison). All implemented once in `support/assert_condition.ts`
(`CONDITIONS`, also backing the `{condition}` oneline parameter type),
exported both as a throwing `assertCondition` (used by every one-shot
`Then`) and a boolean `conditionHolds` (used by polling) — one
implementation of "does this hold," not two. Extend this file, don't
duplicate its logic, if a new condition is ever genuinely needed.

**Symbol/plain-English aliases** — `>`, `>=`, `<`, `<=`, `=`/`==`, `!=`,
`is`, `is not` are real aliases for
`gt`/`gte`/`lt`/`lte`/`equals`/`not_equals`/`equals`/`not_equals`, not a
second vocabulary: `CONDITION_ALIASES` normalizes them to the word form
at the top of the shared `check()` function, so any spelling works
everywhere a condition appears — table `CONDITION` cells and the oneline
`{condition}` parameter alike, with zero duplicated logic:

```gherkin
Then Deployment "<X>" has "status.readyReplicas" >= 1
Then Service "<X>" has "spec.type" == ClusterIP
Then Helm Release "<X>" has "info.status" is deployed
```

The `{condition}` parameter type's regexp carries the words, the
symbols, and `is`/`is not` (still sorted longest-first, so `>=` isn't
shadowed by `>`, and the two-word `is not` isn't shadowed by `is` —
confirmed directly against the real `@cucumber/cucumber-expressions`
matcher: it matches `is not` as one token, never leaking a stray ` not`
into the following `{word}`). Its transformer stays a no-op
passthrough — `check()` does the one real normalization. Word forms are
unaffected; this is purely additive.

## Generic `Then` steps — reuse these, don't write new ones for a new domain

`step_definitions/common.step.ts` holds the type-agnostic assertions
(`the command exited with {int}[:]` and its oneline sibling, `the
command result data has:` and its oneline sibling, `it should have
failed with {string}`/`with either:`) — they only ever read
`World.lastCommandResult`/`World.lastError`, so **every** domain reuses
them unchanged by populating those two fields, rather than inventing
its own status/body assertion. The one time a domain added its own
`Then`s instead (`the response status is {int}[:]`, `the response
headers has:` in `http.step.ts`) was because reusing "the command exited
with" would have read misleadingly for an HTTP status code — a
deliberate, narrow, explicitly-justified exception, not the default
move. Prefer reuse; justify explicitly in a comment when you don't. Three
newer real capabilities (`kubectl exec`, `kubectl auth can-i` for RBAC,
and `openssl x509` TLS certificate inspection — all in
`k8s/kubernetes.step.ts`) are the clean version of this: each writes into
`lastCommandResult` exactly like every other command and adds *zero* new
`Then` vocabulary, even though none of them are "get an object" in any
sense — the reuse works because the generic `Then`s only ever care about
exit code and raw text/structured output, not what kind of command
produced them.

## Dynamic values: capturing a response value, then using it later

A server-generated value (a created resource's real `id`) is only known
*after* a response comes back — `support/http/capture.ts` handles this
via a *second*, narrower `<...>` mechanism scoped only to
`World.capturedValues`, deliberately not merged with the whole-cell
`resolveResource` system (mixing two "what does `<X>` mean" systems
under one syntax would be genuinely ambiguous). `substituteCapturedValues`
resolves `<...>` **embedded** anywhere in a string, not just when the
whole cell is one alias reference. It does not run inside
`KEY|CONDITION|VALUE` assertion tables — only inside the HTTP request
table. See [`rest.md`](rest.md) for the user-facing steps this powers.

## Writing a new scenario: checklist

1. Does an existing alias type already cover what you need? Reuse it.
2. Preamble is self-contained — redeclare `Directory`/`HelmChart`/
   `HelmRelease`/etc. fresh in every scenario, never rely on state from
   another scenario or file.
3. Every table cell is a real field or a real alias reference — never a
   hardcoded value the real system actually computes (an id, a hash, a
   generated name) when you could capture or query it instead.
4. End cluster-touching scenarios with the real cleanup step
   (`uninstall`), even ones that fail partway — check
   `kubectl get all -n thomas-helm-test` / `helm list` after a run,
   not just the exit code.
5. Run it for real before considering it done. Run the whole suite
   twice in a row before considering *cluster-touching* work done —
   idempotency is proven, not assumed. Run only one real suite at a
   time against this cluster — two concurrent `cucumber-js` invocations
   racing the same namespace produces real, confusing false failures,
   not a Thomas bug.

## Adding a new alias type: checklist

1. One new file under `support/<domain>/` exporting the class + its
   `*FromTable()` constructor function, following `Directory` (simplest,
   string alias, no live check) or `HelmChart`/`HelmRelease` (object
   resolution) as the template.
2. A closed `KNOWN_FIELDS` list, validated in the constructor, unless
   the type's fields are genuinely open-ended (see `discoverByLabels`'s
   comment for why it's the one exception).
3. One new `Map<string, T>` field on `World` (`features/support/world.ts`).
4. A `Given <Type> known as "<Alias>":` + `When I attempt to define
   <Type> known as "<Alias>":` pair in the matching
   `step_definitions/<domain>/*.step.ts` file (create a new file/folder
   if this is a new domain). If the type has a closed `KNOWN_FIELDS`
   list, also add the oneline "named field" `Given` sibling(s) — see
   [Oneline construction `Given`
   steps](#oneline-construction-given-steps) above.
5. Decide which of the two resolution kinds it needs (plain string via
   `resolveResource`, or a bespoke object resolver) — don't invent a third.
6. Add negative-path coverage under `features/resources/` (unknown field,
   missing required field, bad alias reference) alongside the existing
   `directory-{short,full}.feature`/`file-{short,full}.feature`/
   `url-{short,full}.feature`/`oci-artifact-{short,full}.feature` files —
   or under `features/helm/` (as
   `helm-repo-validation-{short,full}.feature`/
   `helm-release-validation-{short,full}.feature` do) if the new type is
   one of the object-resolving exceptions instead of a plain Resource.
   `-full.feature` uses the live `DataTable`; `-short.feature` uses the
   [Payload accumulator](#payload-accumulator) — add a `using
   "<PayloadAlias>"` registration for the new type too, reusing its real
   `*FromFields` function.
7. Document it: add its steps and construction shape to the relevant
   [`helm.md`](helm.md)/[`kubectl.md`](kubectl.md)/[`rest.md`](rest.md)
   (or a new reference file, if it's a genuinely new tool domain). For
   the public docs site: a type with real commands of its own
   (`Directory`, `Deployment`/`Service`/`Pod`/`ConfigMap`/`ReplicaSet`/
   `Secret`) is documented in its tool's page
   (`docs/reference/{HELM,KUBECTL,REST}.md`) alongside those commands; a
   type that exists purely to be constructed and referenced, with no
   commands of its own (`File`, `URL`, `OCI Artifact`), belongs on
   `docs/reference/RESOURCES.md` instead, cross-linked from wherever
   it's used.
