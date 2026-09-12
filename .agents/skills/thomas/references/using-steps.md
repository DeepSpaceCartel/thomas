# Using Thomas's steps

How to write a `.feature` file against Thomas's existing steps. See
[`../SKILL.md`](../SKILL.md) first for the general "define, then act"
pattern this extends.

## Table shapes, oneline forms, and short forms

Every construction type has a table form (the base shape) and, for
closed-field types, a oneline sibling that drops `known as` and reads as
a natural sentence:

```gherkin
Given Helm Repo known as "<Alias>":        # PROPERTY|VALUE table - base shape
  | PROPERTY | VALUE |
  | name     | bitnami |
  | url      | https://charts.bitnami.com/bitnami |

Given Helm Repo "<Alias>" named "<name>" at "<url>"   # oneline sibling
```

Action (`When`) steps taking an `OPTION|VALUE` table for CLI flags also
have a short `with <flags>` sibling — a raw, unquoted flag string
tokenized straight to argv (the same shape `buildArgs()` produces from a
table: a bare flag is boolean, `--flag value` is a flag+value pair, a
bare token with no `--` is a positional arg):

```gherkin
When I upgrade Helm Release known as "<Alias>" with:   # table form
  | OPTION             | VALUE |
  | --install          | True  |
  | --atomic           | True  |
  | --create-namespace | True  |

When I upgrade Helm Release "<Alias>" with --install --atomic --create-namespace   # short form
```

The short form covers the common case; fall back to the table form for
anything a flat token stream can't express (a flag value containing a
space without quoting it, or the `VALUE: False` "explicitly omit this
flag" convention, which has no short-form equivalent since the short
form only ever lists what *to* include).

Two of the three-column assertion vocabularies get the same treatment —
a single-condition oneline sibling, `<value>` unquoted (falls back to
the table form for a value containing a space, or for more than one
condition):

```gherkin
Then the command result data has:              # table form
  | KEY                   | CONDITION | VALUE |
  | status.readyReplicas  | gte       | 1     |

Then the command result has "status.readyReplicas" gte 1   # short form

Then the command exited with 0:                 # table form
  | SOURCE | CONDITION | VALUE     |
  | STDOUT | contains  | Succeeded |

Then the command exited with 0 STDOUT contains Succeeded   # short form
```

Polling's `KEY|CONDITION|VALUE|OUTCOME` table has no short form — every
real poll in this suite checks more than one condition together, so a
single-condition oneline wouldn't fit real usage.

An **open-ended field set** (a negative-path test needing an unknown or
missing field, which a fixed-arity oneline genuinely can't express) has
its own short form: a real **Payload accumulator**, built up across
several `Given`/`And` lines, then consumed by a `using "<PayloadAlias>"`
sibling that reuses the exact same real construction function the table
form calls — no second implementation:

```gherkin
Given "<BadDirectoryPayload>" field "xxx" is "./charts"
When I attempt to define Directory known as "<BadDirectory>" using "<BadDirectoryPayload>"
Then it should have failed with 'Directory has no field "xxx"'
```

See [`extending.md`](extending.md) for which types have a `using
"<PayloadAlias>"` registration and the real function each one reuses.

See [`extending.md`](extending.md) for the full 6-vocabulary reference,
the resolution mechanics behind alias substitution, and how to add to
any of this.

## Where to find each tool's steps

| Tool | Reference | Covers |
|---|---|---|
| Helm | [`helm.md`](helm.md) | `Directory`, Chart, Repository, Release — lint/package/template/show, repo add/remove/list, install/upgrade/rollback/get/list |
| kubectl | [`kubectl.md`](kubectl.md) | `Deployment`, `Service`, `Pod`, `ConfigMap`, `ReplicaSet`, `Secret` — label-selector discovery, get/events/logs, polling, exec, RBAC, TLS certificate inspection |
| HTTP/HTTPS | [`rest.md`](rest.md) | HTTP/HTTPS Endpoint — sending a request, asserting the response, capturing a server-generated value for later use |
| Docker | [`docker.md`](docker.md) | `Docker Buildx Builder` — create/remove a real remote-BuildKit builder, build and push a real image, scoped registry credentials |
| SSH | [`ssh.md`](ssh.md) | `SSH Key Pair` — generate a real keypair, scan a real host key |
| TLS | [`tls.md`](tls.md) | `Self-Signed CA`, `TLS Certificate` — generate a real CA and a real certificate it signs |

Every one of those references cites real, runnable scenarios under
`features/{helm,k8s,rest}/*.feature` — use those files as the canonical
examples, not anything invented.
