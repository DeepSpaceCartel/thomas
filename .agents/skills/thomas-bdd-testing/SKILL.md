---
name: thomas-bdd-testing
description: How to write a .feature file against Thomas's real (no-mocks) Helm/kubectl/HTTP steps - the "define, then act" pattern and where to find each tool's step catalog (helm/, kubectl/, rest/). Use when writing or reading ANY Thomas .feature file using existing steps. For adding a new alias type, step, or DataTable shape, see the sibling extend-thomas skill instead.
---

# Using Thomas's steps

Thomas is a real (no-mocks) BDD harness for Helm, `kubectl`, and HTTP,
built on `@cucumber/cucumber` + TypeScript. Every step shells out to a
real binary or makes a real `fetch()` call. This skill is the index for
*using* its steps in a `.feature` file. See `README.md` (repo root of
Thomas) for the full authoritative spec this skill points into.

## Define, then act

Every object gets a name (an "Alias") via a pure `Given <Type> known as
"<Alias>":` step — construction only. Anything that runs a real command
is a separate `When` step referencing the alias:

```gherkin
Given Helm Repo known as "<BitnamiHelmRepo>":
  | PROPERTY | VALUE                              |
  | name     | bitnami                            |
  | url      | https://charts.bitnami.com/bitnami |
When I add Helm Repo known as "<BitnamiHelmRepo>"
Then the command exited with 0
```

A table cell written as `<SomeAlias>` is real substitution against a
previously-registered alias — referencing one that was never defined
fails loudly, it never falls back to treating the text as a literal
string.

## Where to find each tool's steps

| Tool | Reference | Covers |
|---|---|---|
| Helm | [`helm/REFERENCE.md`](helm/REFERENCE.md) | `Directory`, `HelmChart`, `HelmRepo`, `HelmRelease` — lint/package/template/show, repo add/remove/list, install/upgrade/rollback/get/list |
| kubectl | [`kubectl/REFERENCE.md`](kubectl/REFERENCE.md) | `Deployment`, `Service`, `Pod`, `ConfigMap`, `ReplicaSet` — label-selector discovery, get/events/logs, polling for eventually-consistent state |
| HTTP | [`rest/REFERENCE.md`](rest/REFERENCE.md) | `RestEndpoint` — sending a request (headers/query/JSON/multipart), asserting the response, capturing a server-generated value for later use |

Every one of those references cites real, runnable scenarios under
`features/{helm,k8s,rest}/*.feature` — use those files as the canonical
examples, not anything invented.

## Something else you might need

- **Adding a new alias type, step, or DataTable vocabulary?** That's a
  different skill: [`../extend-thomas/SKILL.md`](../extend-thomas/SKILL.md).
  It covers the two kinds of alias resolution, all 6 table vocabularies,
  JMESPath `KEY` queries, and the checklist for adding to Thomas itself.
- **Working on the `charts/rest-api` fixture app** (adding an endpoint,
  changing a health probe) rather than writing a `.feature` file against
  it? See [`../fastapi-test-fixture/SKILL.md`](../fastapi-test-fixture/SKILL.md).
