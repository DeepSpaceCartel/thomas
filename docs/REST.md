# REST (HTTP)

Real `fetch()` calls against a real deployed app's real in-cluster
Service DNS name — no `kubectl port-forward` needed. See [BDD
conventions](bdd-conventions.md) for the underlying pattern and
[Kubernetes: Service](KUBECTL.md#service) for how the `Service` a
`RestEndpoint` wraps is discovered.

## RestEndpoint

### Define a RestEndpoint

```gherkin
Given RestEndpoint known as "<Alias>":
```

Registers a real endpoint: `service` resolves to the actual `Service`
object (its base URL needs the object's real name/namespace), `port` is
the target port. `RestEndpoint.baseUrl` becomes
`http://<service>.<namespace>.svc.cluster.local:<port>`. Construction is
pure — no live check; the first real validation is the paired
`When I send a ...`.

=== "Basic"

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

=== "Advanced"

    ```gherkin
    Given Service known as "<NotesService>":
      | PROPERTY                   | VALUE                 |
      | namespace                  | thomas-helm-test    |
      | app.kubernetes.io/instance | sandbox-notes-release |
    And RestEndpoint known as "<NotesApi>":
      | PROPERTY | VALUE          |
      | service  | <NotesService> |
      | port     | 8000           |
    When I send a POST request to RestEndpoint known as "<NotesApi>" path "/notes/" with:
      | TYPE  | KEY   | VALUE     |
      | FIELD | title | Groceries |
    Then the response status is 201
    ```

    A `Service` discovered from a `HelmRelease`, wrapped as a
    `RestEndpoint`, then used for a real request
    (`features/rest/notes.feature`).

## Sending Requests

### Send a Request

```gherkin
When I send a {word} request to RestEndpoint known as "<Alias>" path "<path>"
```

Sends a bare request (no headers/query/body) — `{word}` is the HTTP
method.

```gherkin
When I send a GET request to RestEndpoint known as "<RestApi>" path "/health/live"
Then the response status is 200
```

### Send a Request with Headers, Query, or Body

```gherkin
When I send a {word} request to RestEndpoint known as "<Alias>" path "<path>" with:
```

Same, plus a `TYPE|KEY|VALUE` table to build headers/query/body. Both
this and the bare form have `I attempt to send a ...` siblings for
genuine network-failure negative tests. `path` and every table `VALUE`
cell go through embedded `<...>`-substitution against
[captured values](#capturing-a-dynamic-value-for-later-use) first.

`TYPE` rows:

| `TYPE` | Meaning |
|---|---|
| `HEADER` | a request header |
| `QUERY` | a query-string parameter |
| `FIELD` | one field of a JSON body — assembled field-by-field into an object |
| `BODY` | escape hatch — the whole cell is a literal string body (JSON or otherwise), for a body too nested for flat `FIELD` rows |
| `FORM` | a plain multipart text field |
| `FILE` | a real file upload — `VALUE` is a path to a real fixture, uploaded under its own basename |

`BODY`/`FIELD` rows/`FORM`+`FILE` rows are three mutually exclusive ways
to build one request body — mixing more than one throws.

??? note "Why a `FormData` body never sets `Content-Type` explicitly"
    A `FormData` body (any `FORM`/`FILE` row) gets **no** explicit
    `Content-Type` header — `fetch()` sets the correct
    `multipart/form-data; boundary=...` value itself. Setting it
    manually omits the boundary and breaks parsing server-side.

=== "JSON fields"

    ```gherkin
    When I send a POST request to RestEndpoint known as "<NotesApi>" path "/notes/" with:
      | TYPE  | KEY   | VALUE      |
      | FIELD | title | Groceries  |
      | FIELD | body  | Milk, eggs |
    Then the response status is 201
    ```

    (`features/rest/notes.feature`)

=== "File upload"

    ```gherkin
    When I send a POST request to RestEndpoint known as "<FilesApi>" path "/files/" with:
      | TYPE | KEY  | VALUE                        |
      | FILE | file | features/fixtures/hello.txt |
    Then the response status is 201
    ```

    (`features/rest/files.feature`)

=== "Form-encoded body"

    ```gherkin
    When I send a POST request to RestEndpoint known as "<AuthApi>" path "/auth/token" with:
      | TYPE   | KEY          | VALUE                                |
      | HEADER | Content-Type | application/x-www-form-urlencoded   |
      | BODY   |              | username=phase3-user&password=secret |
    ```

    The `BODY` escape hatch, used here to build a form-encoded (not
    JSON) payload (`features/rest/auth.feature`).

## Asserting on the Response

### Response Status

```gherkin
Then the response status is {int}
```

Asserts the HTTP status code. A `:` variant takes `SOURCE|CONDITION|VALUE`
rows against the raw body (`SOURCE` currently only `BODY`).

=== "Minimal"

    ```gherkin
    Then the response status is 201
    ```

=== "With a body assertion"

    ```gherkin
    Then the response status is 404:
      | SOURCE | CONDITION | VALUE          |
      | BODY   | contains  | note not found |
    ```

### Response Headers

```gherkin
Then the response headers has:
```

`KEY|CONDITION|VALUE` against response headers — `KEY`s must be
lowercase (`fetch()`'s `Headers` normalizes to lowercase).

```gherkin
Then the response headers has:
  | KEY          | CONDITION | VALUE            |
  | content-type | contains  | application/json |
```

### Response Body (Byte-Exact)

```gherkin
Then the response body equals the real bytes of "<path>"
```

Byte-exact comparison against a real file on disk — never hardcode a
download's expected content as a string when you can compare against
the real fixture that produced it.

```gherkin
Then the response body equals the real bytes of "features/fixtures/hello.txt"
```

### Response as Command Result Data

```gherkin
Then the command result data has:
```

The response is also written into the shared command-result slot
(status → exit code, body → stdout as UTF-8 text), so this generic,
type-agnostic step (JMESPath against the JSON body) keeps working
unchanged for assertions on the response JSON:

```gherkin
Then the command result data has:
  | KEY   | CONDITION | VALUE      |
  | title | equals    | Groceries  |
  | body  | equals    | Milk, eggs |
```

!!! warning "Don't mix up the two boolean conventions"
    Compare a JSON boolean's lowercase string form (`true`/`false`) in
    these tables — the `True`/`False` convention is for `OPTION|VALUE`
    CLI flags only, a different table with a different convention. This
    exact mix-up has already caused one real, confusing test failure.

## Capturing a dynamic value for later use

A server-generated value (a created resource's real `id`) is only known
*after* a response comes back. Three capture forms, all writing into
the same `World.capturedValues` store:

### Capture a Value from the Response Body

```gherkin
Given the value at {string} from the last response is known as {string}
```

```gherkin
When I send a POST request to RestEndpoint known as "<NotesApi>" path "/notes/" with:
  | TYPE  | KEY   | VALUE     |
  | FIELD | title | Groceries |
Given the value at "id" from the last response is known as "<NoteId>"
When I send a GET request to RestEndpoint known as "<NotesApi>" path "/notes/<NoteId>"
```

(`features/rest/notes.feature`)

### Capture a Response Header

```gherkin
Given the value of response header {string} from the last response is known as {string}
```

Stores a response header's raw value, e.g. `Given the value of response
header "Location" from the last response is known as "<Redirect>"`.

### Capture a Query Parameter from a Header

```gherkin
Given the query parameter {string} from response header {string} is known as {string}
```

Extracts one query parameter out of a header's URL value — used when the
value you need is embedded in a redirect URL, not the header itself:

```gherkin
When I send a GET request to RestEndpoint known as "<AuthApi>" path "/oauth/authorize" with:
  | TYPE  | KEY       | VALUE           |
  | QUERY | client_id | sandbox-client  |
  | QUERY | username  | phase3-user     |
  | QUERY | password  | secret          |
Then the response status is 302
Given the query parameter "code" from response header "location" is known as "<AuthCode>"
```

(`features/rest/auth.feature`, capturing an OAuth redirect's `code`)

!!! warning "Captured-value substitution does not run in assertion tables"
    This substitution only applies inside the HTTP request table — it
    does **not** run inside `KEY|CONDITION|VALUE` assertion tables.
    Writing `| id | equals | <NoteId> |` as an assertion compares
    against the literal string `"<NoteId>"` and can never pass; assert
    other real fields instead if you need to prove a fetched value
    matches something captured earlier.

*[BDD]: Behavior-Driven Development
*[CLI]: Command-Line Interface
*[CRD]: Custom Resource Definition
*[JMESPath]: JSON matching expression path — a query language for JSON
*[JSON]: JavaScript Object Notation
*[OCI]: Open Container Initiative
*[YAML]: YAML Ain't Markup Language
