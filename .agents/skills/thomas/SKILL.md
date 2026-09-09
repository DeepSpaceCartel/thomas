---
name: thomas
description: Thomas is a real (no-mocks) BDD harness for Helm, kubectl, and HTTP, built on @cucumber/cucumber + TypeScript. Use this skill whenever writing, reading, or extending a .feature file or step definition in this repo. Index only - points into references/ for the actual content (using existing steps per domain, and the Alias/DataTable methodology for adding to Thomas itself).
---

# Thomas

A real (no-mocks) BDD harness for Helm, `kubectl`, and HTTP, built on
`@cucumber/cucumber` + TypeScript. Every step shells out to a real binary
or makes a real `fetch()` call. See `README.md` (repo root of Thomas) for
the full authoritative spec everything here points into.

## Define, then act

Every object is built by a pure `Given <Type> known as "<Alias>":` step
(or its oneline sibling) — construction only. Anything that runs a real
command is a separate `When` step referencing the alias:

```gherkin
Given Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "https://charts.bitnami.com/bitnami"
When I add Helm Repo known as "<BitnamiHelmRepo>"
Then the command exited with 0
```

A table cell (or oneline parameter) written as `<SomeAlias>` is real
substitution against a previously-registered alias — referencing one
that was never defined fails loudly, it never falls back to treating
the text as a literal string.

## Using existing steps

Writing or reading a `.feature` file against steps that already exist —
**read the relevant reference below first**:

| Tool | Reference | Covers |
|---|---|---|
| — | [`references/using-steps.md`](references/using-steps.md) | Table shapes, oneline forms, the short `with <flags>`/condition companions, and where each tool's catalog lives |
| Helm | [`references/helm.md`](references/helm.md) | `Directory`, Chart, Repository, Release — lint/package/template/show, repo add/remove/list, install/upgrade/rollback/get/list |
| kubectl | [`references/kubectl.md`](references/kubectl.md) | `Deployment`, `Service`, `Pod`, `ConfigMap`, `ReplicaSet`, `Secret` — label-selector discovery, get/events/logs, polling, exec, RBAC (`kubectl auth can-i`), TLS certificate inspection |
| HTTP/HTTPS | [`references/rest.md`](references/rest.md) | HTTP/HTTPS Endpoint — sending a request (headers/query/JSON/multipart), asserting the response, capturing a server-generated value for later use |

Every reference cites real, runnable scenarios under
`features/{helm,k8s,rest}/*.feature` — use those files as the canonical
examples, not anything invented.

## Extending Thomas itself

Adding a new alias type, a new step, or a new table/oneline vocabulary
to Thomas — **not** just using an existing one — see
[`references/extending.md`](references/extending.md): the two kinds of
alias resolution, all 6 table vocabularies plus their oneline
companions, JMESPath `KEY` queries, conditions, the generic-`Then`-reuse
rule, and the writing/extending checklists.

## Something else you might need

- **Working on the `charts/test-rest-api` fixture app** (adding an
  endpoint, changing a health probe) rather than writing a `.feature`
  file against it? See `charts/test-rest-api/README.md` — the full
  design rationale lives there now, not in a separate skill.
