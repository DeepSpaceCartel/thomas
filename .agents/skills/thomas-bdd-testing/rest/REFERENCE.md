# HTTP / REST steps

Real `fetch()` calls against a real deployed app's real Service DNS
name — the Cucumber process has direct network/DNS routing to it, no
`kubectl port-forward` needed. See [`../SKILL.md`](../SKILL.md) first,
and [`../kubectl/REFERENCE.md`](../kubectl/REFERENCE.md) for how the
`Service` a `RestEndpoint` wraps gets discovered.

## `RestEndpoint`

```gherkin
Given Service known as "<ApiService>":
  | PROPERTY                   | VALUE               |
  | namespace                  | thomas-helm-test  |
  | app.kubernetes.io/instance | sandbox-my-release  |
And RestEndpoint known as "<Api>":
  | PROPERTY | VALUE        |
  | service  | <ApiService> |
  | port     | 8000         |
```
`RestEndpoint.baseUrl` is
`http://<service>.<namespace>.svc.cluster.local:<port>` — its `service`
field resolves to the real `Service` **object**, not a string, since it
needs the object's real `.name`/`.namespace`. Its `Given` stays pure
construction (no live check) — the first real validation is the paired
`When I send a ...`.

## Sending a request

```gherkin
When I send a {word} request to RestEndpoint known as {string} path {string}
When I send a {word} request to RestEndpoint known as {string} path {string} with:
```
(`{word}` is the HTTP method.) Both have `I attempt to send a ...`
siblings for genuine network-failure negative tests. `path` and every
table `VALUE` cell go through embedded `<...>`-substitution against
captured values (see below) before the request is built.

`TYPE` rows in the request table:

| `TYPE` | Meaning |
|---|---|
| `HEADER` | a request header |
| `QUERY` | a query-string parameter |
| `FIELD` | one field of a JSON body — assembled into an object field-by-field |
| `BODY` | escape hatch — the whole cell is a literal JSON (or raw) string, for a body too nested for flat `FIELD` rows |
| `FORM` | a plain multipart text field |
| `FILE` | a real file upload — `VALUE` is a path to a real fixture, uploaded under its own basename |

`BODY`/`FIELD` rows/`FORM`+`FILE` rows are three mutually exclusive ways
to build one request body — mixing more than one throws. A `FormData`
body gets **no** explicit `Content-Type` — `fetch()` sets the correct
`multipart/form-data; boundary=...` value itself.

**In practice, JSON fields** (`features/rest/notes.feature`):
```gherkin
When I send a POST request to RestEndpoint known as "<NotesApi>" path "/notes/" with:
  | TYPE  | KEY   | VALUE      |
  | FIELD | title | Groceries  |
  | FIELD | body  | Milk, eggs |
Then the response status is 201
```

**In practice, a real file upload** (`features/rest/files.feature`):
```gherkin
When I send a POST request to RestEndpoint known as "<FilesApi>" path "/files/" with:
  | TYPE | KEY  | VALUE                        |
  | FILE | file | features/fixtures/hello.txt |
Then the response status is 201
```

**In practice, a form-encoded body via the `BODY` escape hatch**
(`features/rest/auth.feature`, OAuth2 token exchange):
```gherkin
When I send a POST request to RestEndpoint known as "<AuthApi>" path "/auth/token" with:
  | TYPE   | KEY          | VALUE                                |
  | HEADER | Content-Type | application/x-www-form-urlencoded   |
  | BODY   |              | username=phase3-user&password=secret |
```

## Asserting on the response

```gherkin
Then the response status is {int}
Then the response status is {int}:              # + SOURCE|CONDITION|VALUE, SOURCE currently only BODY
Then the response headers has:                  # KEY|CONDITION|VALUE - KEYs must be lowercase
Then the response body equals the real bytes of {string}   # byte-exact vs. a real fixture file
```
The response is also written into `World.lastCommandResult`, so the
generic `the command result data has:` step (JMESPath against the JSON
body) keeps working unchanged:
```gherkin
Then the command result data has:
  | KEY   | CONDITION | VALUE     |
  | title | equals    | Groceries |
```
**Compare a JSON boolean's lowercase string form** (`true`/`false`) in
these tables — the `True`/`False` convention is for `OPTION|VALUE` CLI
flags only, a different table with a different convention.

**In practice, a byte-exact download check** (`features/rest/files.feature`):
```gherkin
When I send a GET request to RestEndpoint known as "<FilesApi>" path "/files/<FileId>/download"
Then the response status is 200
Then the response body equals the real bytes of "features/fixtures/hello.txt"
```

## Capturing a dynamic value for later use

A server-generated value (a created resource's real `id`) is only known
*after* a response comes back:
```gherkin
When I send a POST request to RestEndpoint known as "<Api>" path "/notes/" with:
  | TYPE  | KEY   | VALUE |
  | FIELD | title | Hi    |
Given the value at "id" from the last response is known as "<NoteId>"
When I send a GET request to RestEndpoint known as "<Api>" path "/notes/<NoteId>"
```
Two other capture forms exist:
```gherkin
Given the value of response header {string} from the last response is known as {string}
Given the query parameter {string} from response header {string} is known as {string}
```
**In practice, capturing an OAuth redirect's `code` query parameter**
(`features/rest/auth.feature`):
```gherkin
When I send a GET request to RestEndpoint known as "<AuthApi>" path "/oauth/authorize" with:
  | TYPE  | KEY       | VALUE                            |
  | QUERY | client_id | sandbox-client                   |
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
