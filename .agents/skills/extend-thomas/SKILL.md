---
name: extend-thomas
description: How Thomas's Alias/DataTable machinery works internally, and how to add a new alias type, step, or DataTable vocabulary to it - the two kinds of alias resolution, all 6 table header vocabularies (as extension points, not just a reference), JMESPath KEY queries, conditions, the generic-Then-reuse rule, and the writing/extending checklists. Use when adding a new alias type, a new step, or a new table shape - NOT for writing a .feature file against steps that already exist (see the sibling thomas-bdd-testing skill for that).
---

# Extending Thomas

This is how every `.feature` file in Thomas is written, and how to add
to that vocabulary safely — not generic Cucumber advice, this project's
own convention, evolved over many rounds of review. Follow it exactly;
don't improvise a new shape when an existing one already fits. If you
just want to *use* an existing step, see
[`../thomas-bdd-testing/SKILL.md`](../thomas-bdd-testing/SKILL.md)
instead — this skill is for changing Thomas itself.

## Every alias type is one `Map<string, T>` on `World`

`features/support/world.ts` holds one `Map<string, T>` field per alias
type (`charts`, `repos`, `helmReleases`, `directories`, `files`, `urls`,
`ociArtifacts`, `deployments`, `services`, `pods`, `configMaps`,
`replicaSets`, `restEndpoints`),
keyed by the literal alias string *including* the `<...>` brackets, plus
`capturedValues: Map<string, string>` for dynamic capture (see below). A
new alias type = one new file under `support/<domain>/`, one new `Map`
field on `World`, and a `Given`/`When I attempt to define ...` pair in
the matching `step_definitions/*.step.ts` file, following an existing
type's shape — `Directory`, `HelmChart`, `HelmRelease` are good templates,
roughly in increasing order of how special their resolution is.

## Two kinds of alias resolution

Most types resolve to a plain **string** (a path, URL, ref) via the
shared `resolveAlias()` (`support/aliases/resolve_alias.ts`). A few
resolve to the real **object** instead, because a string would have
already lost structure the type needs later:
- `HelmRelease.chart` needs the actual `HelmChart` object (its real CLI args
  depend on `chart.kind`) — resolved via a bespoke
  `(alias) => HelmChart | undefined` callback built in `release.step.ts`
  and passed into `releaseFromTable`.
- `RestEndpoint.service` needs the actual `Service` object (its base URL
  needs the object's real `.name`/`.namespace`) — same shape, via
  `restEndpointFromTable`.

Don't invent a third resolution mechanism — every new type fits one of
these two. `Deployment`/`Service`/`Pod` are a different kind of
exception entirely: their `Given` performs a real, read-only `kubectl
get` (`support/k8s/discover.ts`'s `discoverByLabels`) rather than pure
construction — justified as the same category as `Directory`'s real
`fs.existsSync` check, not a new kind of exception. `RestEndpoint`'s
`Given` stays pure (no live check) — there's no cheap read-only analog
to "is this URL reachable."

Every alias-constructing `*FromTable()` function converts the
DataTable's `PROPERTY|VALUE` hashes into a `Record<string, string>` and
validates against a closed `KNOWN_FIELDS` list, throwing `"<Type> has no
field \"<key>\""` for anything unrecognized — except `discoverByLabels`,
which has no closed list, since a real chart's label set is open-ended
(only `namespace` is a recognized non-label field there).

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
| `TYPE` \| `KEY` \| `VALUE` | `When I send a {httpMethod} request ... with:` | Builds a real HTTP request (`HEADER`/`QUERY`/`FIELD`/`BODY`/`FORM`/`FILE`) |

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
comparison). All implemented once in `support/assert_condition.ts`,
exported both as a throwing `assertCondition` (used by every one-shot
`Then`) and a boolean `conditionHolds` (used by polling) — one
implementation of "does this hold," not two. Extend this file, don't
duplicate its logic, if a new condition is ever genuinely needed.

## Generic `Then` steps — reuse these, don't write new ones for a new domain

`step_definitions/common.step.ts` holds the type-agnostic assertions
(`the command exited with {int}[:]`, `the command result data has:`,
`it should have failed with {string}`/`with either:`) — they only ever
read `World.lastCommandResult`/`World.lastError`, so **every** domain
reuses them unchanged by populating those two fields, rather than
inventing its own status/body assertion. The one time a domain added its
own `Then`s instead (`the response status is {int}[:]`, `the response
headers has:` in `http.step.ts`) was because reusing "the command exited
with" would have read misleadingly for an HTTP status code — a
deliberate, narrow, explicitly-justified exception, not the default
move. Prefer reuse; justify explicitly in a comment when you don't.

## Dynamic values: capturing a response value, then using it later

A server-generated value (a created resource's real `id`) is only known
*after* a response comes back — `support/http/capture.ts` handles this
via a *second*, narrower `<...>` mechanism scoped only to
`World.capturedValues`, deliberately not merged with the whole-cell
`resolveAlias` system (mixing two "what does `<X>` mean" systems under
one syntax would be genuinely ambiguous). `substituteCapturedValues`
resolves `<...>` **embedded** anywhere in a string, not just when the
whole cell is one alias reference. It does not run inside
`KEY|CONDITION|VALUE` assertion tables — only inside the HTTP request
table. See `../thomas-bdd-testing/rest/REFERENCE.md` for the
user-facing steps this powers.

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
   idempotency is proven, not assumed.

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
   `step_definitions/*.step.ts` file (create a new file if this is a new
   domain).
5. Decide which of the two resolution kinds it needs (plain string via
   `resolveAlias`, or a bespoke object resolver) — don't invent a third.
6. Add negative-path coverage under `features/aliases/` (unknown field,
   missing required field, bad alias reference) alongside the existing
   `alias-*.feature` files.
7. Document it: add its steps and alias construction shape to the
   relevant `../thomas-bdd-testing/{helm,kubectl,rest}/REFERENCE.md`
   (or a new subfolder, if it's a genuinely new tool domain). For the
   public docs site: a type with real commands of its own (`Directory`,
   `Deployment`/`Service`/`Pod`/`ConfigMap`/`ReplicaSet`) is documented
   in its tool's page (`docs/{HELM,KUBECTL,REST}.md`) alongside those
   commands; a type that exists purely to be constructed and referenced,
   with no commands of its own (`File`, `URL`, `OCIArtifact`), belongs on
   `docs/ALIASES.md` instead, cross-linked from wherever it's used.
