# HTTP / HTTPS steps

Real `fetch()` calls against a real deployed app's real Service DNS
name — the Cucumber process has direct network/DNS routing to it, no
`kubectl port-forward` needed. See [`../SKILL.md`](../SKILL.md) first,
and [`kubectl.md`](kubectl.md) for how the `Service` an Endpoint wraps
gets discovered. These steps are the same shape as `curl -X <method>
<url> -H ... -d ...` — if you already know `curl`, you already know what
each `TYPE` row below is for.

## HTTP Endpoint

```gherkin
Given Service known as "<ApiService>":
  | PROPERTY                   | VALUE               |
  | namespace                  | thomas-helm-test  |
  | app.kubernetes.io/instance | thomas-my-release  |
And HTTP Endpoint "<Api>" on "<ApiService>" port "8000"
```
An `HTTP Endpoint` has exactly two real fields (`service`, `port`),
always used together — the oneline form above covers every real case;
the `PROPERTY|VALUE` table form (`Given HTTP Endpoint known as
{string}:`) remains for the "I attempt to define ..." negative tests.

`RestEndpoint.baseUrl` is
`http://<service>.<namespace>.svc.cluster.local:<port>` — its `service`
field resolves to the real `Service` **object**, not a string, since it
needs the object's real `.name`/`.namespace`. Its `Given` stays pure
construction (no live check) — the first real validation is the paired
`When I send a ...`.

## HTTPS Endpoint

```gherkin
Given HTTPS Endpoint "<Api>" on "<ApiService>" port "8443" trusting "<ApiSecret>"
```
Same `service`/`port`, plus a required `trust` — a registered `Secret`
alias (see [`kubectl.md`](kubectl.md#tls-certificate-inspection)).
`RestEndpoint.caCert` is
that Secret's real, decoded `data["tls.crt"]` — a self-signed cert is
its own CA, so no separate `ca.crt` field is needed. Every real request
against this endpoint verifies the server's certificate against exactly
that PEM via a real, per-request `undici` `Agent` (`support/http/
http_request.ts`) — never a blanket `rejectUnauthorized: false`, so a
genuinely wrong/expired/mismatched certificate makes the real request
throw (`fetch failed`, with the specific reason on `error.cause`), not
silently succeed.

**In practice** (`features/rest/health-full.feature`):
```gherkin
Given Secret known as "<TlsApiSecret>":
  | PROPERTY                   | VALUE               |
  | namespace                  | thomas-helm-test    |
  | app.kubernetes.io/instance | thomas-rest-api-tls |
And HTTPS Endpoint "<TlsApi>" on "<TlsApiService>" port "8443" trusting "<TlsApiSecret>"
When I send a GET request to Endpoint known as "<TlsApi>" path "/health/live"
Then the response status is 200
```
`charts/test-rest-api`'s own `values.tls.enabled` (default `false`)
follows the exact same `selfSigned` cert-manager `Issuer`/`Certificate`
pattern as `charts/test-tls-demo` (see
[`kubectl.md`](kubectl.md#tls-certificate-inspection)) —
a second real `uvicorn` process terminates TLS on `values.tls.port`
(default `8443`) using its own native `--ssl-keyfile`/`--ssl-certfile`
flags, alongside the existing plain-HTTP listener (unchanged, still what
the k8s health probes use).

## Sending a request

```gherkin
When I send a {httpMethod} request to Endpoint known as {string} path {string}
When I send a {httpMethod} request to Endpoint known as {string} path {string} with:
```
Works identically against an `HTTP Endpoint` or an `HTTPS Endpoint` alias
— the scheme is already baked into the registered object, so these
lookup-only steps don't repeat it. `{httpMethod}` is a real Cucumber
custom parameter type (`support/http/http_method.ts`) that only matches
`GET`/`POST`/`PUT`/`PATCH`/`DELETE` — the exact set `charts/test-rest-api/`
exposes and every scenario exercises. An unlisted method fails to match
any step at all, rather than being sent and failing at the HTTP layer.
Both have `I attempt to send a ...` siblings for genuine network-failure
negative tests. `path` and every table `VALUE` cell go through embedded
`<...>`-substitution against captured values (see below) before the
request is built.

`TYPE` rows in the request table:

| `TYPE` | Meaning |
|---|---|
| `HEADER` | a request header |
| `QUERY` | a query-string parameter |
| `FIELD` | one field of a JSON body — assembled into an object field-by-field |
| `BODY` | escape hatch — the whole cell is a literal JSON (or raw) string, for a body too nested for flat `FIELD` rows |
| `FORM` | a plain multipart text field |
| `FILE` | a real file upload — `VALUE` is a path to a real fixture, uploaded under its own basename |
| `BASIC_AUTH` | HTTP Basic auth, the `curl -u` equivalent — `KEY`/`VALUE` are username/password, base64-encoded into a real `Authorization: Basic ...` header |

`BODY`/`FIELD` rows/`FORM`+`FILE` rows/a `BASIC_AUTH` row are mutually
exclusive ways to build one request's body/auth — mixing more than one
of the body-building kinds throws. A `FormData` body gets **no**
explicit `Content-Type` — `fetch()` sets the correct
`multipart/form-data; boundary=...` value itself.

**In practice, JSON fields** (`features/rest/notes-full.feature`):
```gherkin
When I send a POST request to Endpoint known as "<NotesApi>" path "/notes/" with:
  | TYPE  | KEY   | VALUE      |
  | FIELD | title | Groceries  |
  | FIELD | body  | Milk, eggs |
Then the response status is 201
```

**In practice, a real file upload** (`features/rest/files-full.feature`):
```gherkin
When I send a POST request to Endpoint known as "<FilesApi>" path "/files/" with:
  | TYPE | KEY  | VALUE                        |
  | FILE | file | features/fixtures/hello.txt |
Then the response status is 201
```

**In practice, HTTP Basic auth** (`features/rest/auth-full.feature`):
```gherkin
When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/basic/whoami" with:
  | TYPE       | KEY         | VALUE  |
  | BASIC_AUTH | phase3-user | secret |
Then the response status is 200
```

**In practice, a form-encoded body via the `BODY` escape hatch**
(`features/rest/auth-full.feature`, OAuth2 token exchange):
```gherkin
When I send a POST request to Endpoint known as "<AuthApi>" path "/auth/token" with:
  | TYPE   | KEY          | VALUE                                |
  | HEADER | Content-Type | application/x-www-form-urlencoded   |
  | BODY   |              | username=phase3-user&password=secret |
```

## Building a request with FIELD rows (the request accumulator)

A second, additive short form specifically for a `FIELD`-only request:
build the row set across several `Given`/`And` lines, then send it as
one unit. `HEADER`/`QUERY`/`BASIC_AUTH`/`BODY`/`FORM`/`FILE` rows still
need the `with:` table above — they're not all flat `key: value` pairs,
and this accumulator only ever appends `RequestRow`s of a given `TYPE`,
never assembles the other kinds:

```gherkin
Given {string} has {word} {string} {string}
When I send {string} as {httpMethod} to Endpoint known as {string} path {string}
```

`{word}` is the row's `TYPE` (`FIELD`, but also `HEADER`/`QUERY`/etc. —
the accumulator itself is type-agnostic even though `FIELD` is the only
real use today); `http.step.ts`'s `Given` appends one `RequestRow` into
`World.pendingRequests.get(alias) ?? []`. **No request is sent** until
the paired `When I send "<Alias>" as ...` step consumes the accumulated
rows and builds the request through the exact same real code path the
`with:` table form uses — one implementation, not two.

```gherkin
Given "<NewGroceryNote>" has FIELD "title" "Groceries"
And "<NewGroceryNote>" has FIELD "body" "Milk, eggs"
When I send "<NewGroceryNote>" as POST to Endpoint known as "<NotesApi>" path "/notes/"
Then the response status is 201
```

The [Payload accumulator](extending.md#payload-accumulator) (for
open-ended *construction* fields, e.g. a negative-path `Directory`)
deliberately uses different step wording (`field {string} is {string}`,
not `has {word} {string} {string}`) — an earlier attempt at shared
wording turned out genuinely ambiguous against this exact step, caught
via a real `cucumber-js --dry-run`; see that section for the full story.

## Asserting on the response

```gherkin
Then the response status is {int}
Then the response status is {int}:              # + SOURCE|CONDITION|VALUE, SOURCE currently only BODY
Then the response headers has:                  # KEY|CONDITION|VALUE - KEYs must be lowercase
Then the response body equals the real bytes of {string}   # byte-exact vs. a real fixture file
```
The response is also written into `World.lastCommandResult`, so the
generic `the command result data has:` step (JMESPath against the JSON
body) and its oneline single-condition sibling keep working unchanged:
```gherkin
Then the command result data has:
  | KEY   | CONDITION | VALUE     |
  | title | equals    | Groceries |
```
**Compare a JSON boolean's lowercase string form** (`true`/`false`) in
these tables — the `True`/`False` convention is for `OPTION|VALUE` CLI
flags only, a different table with a different convention.

**In practice, a byte-exact download check** (`features/rest/files-full.feature`):
```gherkin
When I send a GET request to Endpoint known as "<FilesApi>" path "/files/<FileId>/download"
Then the response status is 200
Then the response body equals the real bytes of "features/fixtures/hello.txt"
```

## Capturing a dynamic value for later use

A server-generated value (a created resource's real `id`) is only known
*after* a response comes back:
```gherkin
When I send a POST request to Endpoint known as "<Api>" path "/notes/" with:
  | TYPE  | KEY   | VALUE |
  | FIELD | title | Hi    |
Given the value at "id" from the last response is known as "<NoteId>"
When I send a GET request to Endpoint known as "<Api>" path "/notes/<NoteId>"
```
Two other capture forms exist:
```gherkin
Given the value of response header {string} from the last response is known as {string}
Given the query parameter {string} from response header {string} is known as {string}
```
**In practice, capturing an OAuth redirect's `code` query parameter**
(`features/rest/auth-full.feature`):
```gherkin
When I send a GET request to Endpoint known as "<AuthApi>" path "/oauth/authorize" with:
  | TYPE  | KEY       | VALUE                            |
  | QUERY | client_id | thomas-client                   |
  | QUERY | username  | phase3-user                      |
  | QUERY | password  | secret                           |
Then the response status is 302
Given the query parameter "code" from response header "location" is known as "<AuthCode>"
```
This substitution **does not run inside `KEY|CONDITION|VALUE` assertion
tables** — only inside the HTTP request table. Writing
`| id | equals | <NoteId> |` as an assertion compares against the
literal string `"<NoteId>"` and can never pass.

## Verifying a real upload/download round trip

Never assert a download's content against a hardcoded expected string —
use `the response body equals the real bytes of "<path>"` against a real
fixture checked into the repo, so the test proves the real bytes
round-tripped, not that they match something typed by hand.
