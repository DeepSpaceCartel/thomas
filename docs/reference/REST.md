# REST (HTTP/HTTPS)

Real `fetch()` calls against a real deployed app's real in-cluster
Service DNS name — no `kubectl port-forward` needed. These steps are the
same shape as `curl -X <method> <url> -H ... -d ...`, just as a real
Gherkin table instead of flags. See [BDD
conventions](../concepts/bdd-conventions.md) for the underlying pattern
and [Kubernetes: Service](KUBECTL.md#service) for how the `Service` an
`Endpoint` wraps is discovered.

## HTTP/HTTPS Endpoint

### Define an HTTP Endpoint

=== "Short"

    ```gherkin
    Given HTTP Endpoint "<Api>" on "<ApiService>" port "8000"
    ```

=== "Full"

    ```gherkin
    Given HTTP Endpoint known as "<Api>":
      | PROPERTY | VALUE        |
      | service  | <ApiService> |
      | port     | 8000         |
    ```

Registers a real endpoint: `service` resolves to the actual `Service`
object (its base URL needs the object's real name/namespace), `port` is
the target port. `RestEndpoint.baseUrl` becomes
`http://<service>.<namespace>.svc.cluster.local:<port>`. Construction is
pure — no live check; the first real validation is the paired
`When I send a ...`. Negative-path tests (an unregistered `service`
alias reference) use the same [Payload
accumulator](../concepts/bdd-conventions.md#construction) shape as
every other constructed type:

```gherkin
Given "<BadEndpointPayload>" field "service" is "<UndefinedRestService>"
And "<BadEndpointPayload>" field "port" is "8000"
When I attempt to define HTTP Endpoint known as "<BadEndpoint>" using "<BadEndpointPayload>"
Then it should have failed with 'No Service registered as "<UndefinedRestService>"'
```

=== "Discovered from a Helm Release, then used"

    ```gherkin
    Given Service known as "<NotesService>":
      | PROPERTY                   | VALUE                 |
      | namespace                  | thomas-helm-test    |
      | app.kubernetes.io/instance | thomas-notes-release |
    And HTTP Endpoint "<NotesApi>" on "<NotesService>" port "8000"
    When I send a POST request to Endpoint known as "<NotesApi>" path "/notes/" with:
      | TYPE  | KEY   | VALUE     |
      | FIELD | title | Groceries |
    Then the response status is 201
    ```

    A `Service` discovered from a `Helm Release`, wrapped as an
    `HTTP Endpoint`, then used for a real request.

### Define an HTTPS Endpoint

=== "Short"

    ```gherkin
    Given HTTPS Endpoint "<TlsRestApi>" on "<TlsRestApiService>" port "8443" trusting "<TlsRestApiSecret>"
    ```

=== "Full"

    ```gherkin
    Given HTTPS Endpoint known as "<TlsRestApi>":
      | PROPERTY | VALUE                  |
      | service  | <TlsRestApiService>    |
      | port     | 8443                   |
      | trust    | <TlsRestApiSecret>     |
    ```

Same `service`/`port` fields, plus a required `trust` — a registered
[`Secret`](KUBECTL.md#secret) whose real `data["tls.crt"]` becomes the
one certificate this endpoint's real per-request `undici` `Agent` trusts.
Verification stays real: it is never disabled (no
`rejectUnauthorized: false` anywhere in this project), so a request
against a genuinely wrong/expired/mismatched certificate throws for
real rather than silently succeeding — see [BDD conventions: Define,
then act](../concepts/bdd-conventions.md#define-then-act) for why
construction itself still does no live check. Negative-path coverage
(a missing `trust` field) is in `features/rest/health-full.feature`:

```gherkin
When I attempt to define HTTPS Endpoint known as "<TrustlessEndpoint>":
  | PROPERTY | VALUE              |
  | service  | <TrustlessService> |
  | port     | 8443               |
Then it should have failed with 'An HTTPS Endpoint requires a "trust" field naming a registered Secret to verify against'
```

**In practice** (`features/rest/health-{short,full}.feature`):
```gherkin
Given Service known as "<TlsRestApiService>":
  | PROPERTY                   | VALUE                |
  | namespace                  | thomas-helm-test      |
  | app.kubernetes.io/instance | thomas-rest-api-tls   |

# Real cert-manager async issuance - same bounded-retry Secret discovery
# as [Kubernetes: TLS](KUBECTL.md#tls-certificates).
Given Secret known as "<TlsRestApiSecret>":
  | PROPERTY                   | VALUE                |
  | namespace                  | thomas-helm-test      |
  | app.kubernetes.io/instance | thomas-rest-api-tls   |

And HTTPS Endpoint "<TlsRestApi>" on "<TlsRestApiService>" port "8443" trusting "<TlsRestApiSecret>"
When I send a GET request to Endpoint known as "<TlsRestApi>" path "/health/live"
Then the response status is 200
```

A self-signed certificate is its own CA, so the same `tls.crt` the
server presents is exactly what a client needs to trust it — no separate
`ca.crt` field, no new Secret shape; this reuses the `Secret` kind
already built for [Kubernetes: TLS](KUBECTL.md#tls-certificates) directly.

## Sending Requests

### Send a Request

```gherkin
When I send a {httpMethod} request to Endpoint known as "<Alias>" path "<path>"
```

Sends a bare request (no headers/query/body). `{httpMethod}` accepts
exactly `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` — the real method set
this project's REST fixture (`charts/test-rest-api/`) exposes and every
scenario exercises. Writing anything else (e.g. `TRACE`) fails to match
any step at all, rather than being sent and failing at the HTTP layer.

```gherkin
When I send a GET request to Endpoint known as "<RestApi>" path "/health/live"
Then the response status is 200
```

### Send a Request with Headers, Query, or Body

```gherkin
When I send a {httpMethod} request to Endpoint known as "<Alias>" path "<path>" with:
```

Same, plus a `TYPE|KEY|VALUE` table to build headers/query/body. Both
this and the bare form have `I attempt to send a ...` siblings for
genuine network-failure negative tests. `path` and every table `VALUE`
cell go through embedded `<...>`-substitution against
[captured values](#capturing-a-dynamic-value-for-later-use) first.
`BODY`/`FIELD` rows/`FORM`+`FILE` rows are three mutually exclusive ways
to build one request body — mixing more than one throws.

A second, additive short form exists specifically for `FIELD` rows: a
real [Payload accumulator](../concepts/bdd-conventions.md#construction)
built up across several `Given`/`And` lines, then sent as one unit —
`HEADER`/`QUERY`/`BASIC_AUTH`/`BODY`/`FORM`/`FILE` rows still need the
table form shown above, since they're not all flat `key: value` pairs:

=== "Short"

    ```gherkin
    Given "<NewGroceryNote>" has FIELD "title" "Groceries"
    And "<NewGroceryNote>" has FIELD "body" "Milk, eggs"
    When I send "<NewGroceryNote>" as POST to Endpoint known as "<NotesApi>" path "/notes/"
    Then the response status is 201
    ```

=== "Full"

    ```gherkin
    When I send a POST request to Endpoint known as "<NotesApi>" path "/notes/" with:
      | TYPE  | KEY   | VALUE     |
      | FIELD | title | Groceries |
      | FIELD | body  | Milk, eggs |
    Then the response status is 201
    ```

#### `HEADER`

A request header.

A single header also has a oneline `with header {string} {string}`
sibling — the table form is what a 2+ header request, or one combined
with other row types, needs instead:

=== "Short"

    ```gherkin
    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/api-key/whoami" with header "X-API-Key" "<ApiKey>"
    Then the response status is 200
    ```

=== "Full"

    ```gherkin
    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/api-key/whoami" with:
      | TYPE   | KEY       | VALUE    |
      | HEADER | X-API-Key | <ApiKey> |
    Then the response status is 200
    ```

#### `QUERY`

A query-string parameter.

A single query parameter also has a oneline `with query {string}
{string}` sibling; 2+ parameters (as in the OAuth `/oauth/authorize`
example below) need the table form:

=== "Short"

    ```gherkin
    When I send a PUT request to Endpoint known as "<ReadinessApi>" path "/_test/ready" with query "ready" "false"
    Then the response status is 200
    ```

=== "Full"

    ```gherkin
    When I send a PUT request to Endpoint known as "<ReadinessApi>" path "/_test/ready" with:
      | TYPE  | KEY   | VALUE |
      | QUERY | ready | false |
    Then the response status is 200
    ```

```gherkin
When I send a GET request to Endpoint known as "<AuthApi>" path "/oauth/authorize" with:
  | TYPE  | KEY       | VALUE          |
  | QUERY | client_id | thomas-client |
  | QUERY | username  | phase3-user    |
  | QUERY | password  | secret         |
Then the response status is 302
```

#### `FIELD`

One field of a JSON body, assembled field-by-field.

Multiple `FIELD` rows also have the [request
accumulator](#send-a-request-with-headers-query-or-body) short form
shown above. A `PATCH` with only some fields is a genuine **partial**
update, unlike `PUT`'s full replace — this real example only touches
`title`, and proves `body` survived untouched:

=== "Short"

    ```gherkin
    Given "<GroceryNoteTitlePatch>" has FIELD "title" "Groceries v3"
    When I send "<GroceryNoteTitlePatch>" as PATCH to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the response status is 200
    Then the command result has "title" is "Groceries v3"
    Then the command result has "body" is "Milk, eggs, bread"
    ```

=== "Full"

    ```gherkin
    When I send a PATCH request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>" with:
      | TYPE  | KEY   | VALUE        |
      | FIELD | title | Groceries v3 |
    Then the response status is 200
    Then the command result data has:
      | KEY   | CONDITION | VALUE             |
      | title | equals    | Groceries v3      |
      | body  | equals    | Milk, eggs, bread |
    ```

#### `BASIC_AUTH`

HTTP Basic auth, the `curl -u` equivalent.

`KEY`/`VALUE` are the real, plain username/password — base64-encoded
into a real `Authorization: Basic ...` header for you, the same way
curl's `-u user:pass` does. No hand-encoding (and no hardcoded base64
string sitting in a `.feature` file) needed. A single `BASIC_AUTH` row
also has a oneline `with basic auth {string} {string}` sibling:

=== "Short"

    ```gherkin
    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/basic/whoami" with basic auth "phase3-user" "secret"
    Then the response status is 200
    ```

=== "Full"

    ```gherkin
    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/basic/whoami" with:
      | TYPE       | KEY         | VALUE  |
      | BASIC_AUTH | phase3-user | secret |
    Then the response status is 200
    ```

#### `BODY`

Escape hatch: the whole cell is a literal string body.

For a body too nested for flat `FIELD` rows, or a non-JSON content type:

```gherkin
When I send a POST request to Endpoint known as "<AuthApi>" path "/auth/token" with:
  | TYPE   | KEY          | VALUE                                |
  | HEADER | Content-Type | application/x-www-form-urlencoded   |
  | BODY   |              | username=phase3-user&password=secret |
```

#### `FORM` / `FILE`

A real multipart body.

`FORM` is a plain multipart text field; `FILE`'s `VALUE` is a path to a
real fixture on disk, read and uploaded under its own basename:

```gherkin
When I send a POST request to Endpoint known as "<FilesApi>" path "/files/" with:
  | TYPE | KEY  | VALUE                        |
  | FILE | file | features/fixtures/hello.txt |
Then the response status is 201
```

??? note "Why a `FormData` body never sets `Content-Type` explicitly"
    A `FormData` body (any `FORM`/`FILE` row) gets **no** explicit
    `Content-Type` header — `fetch()` sets the correct
    `multipart/form-data; boundary=...` value itself. Setting it
    manually omits the boundary and breaks parsing server-side.

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
Then the response header {string} {condition} {word}    # oneline sibling, one header at a time
```

`KEY|CONDITION|VALUE` against response headers — `KEY`s must be
lowercase (`fetch()`'s `Headers` normalizes to lowercase).

=== "Short"

    ```gherkin
    Then the response header "content-type" contains application/json
    ```

=== "Full"

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
Then the command result has {string} {condition} {word}    # oneline sibling, one condition at a time
```

The response is also written into the shared command-result slot
(status → exit code, body → stdout as UTF-8 text), so this generic,
type-agnostic step (JMESPath against the JSON body) keeps working
unchanged for assertions on the response JSON:

=== "Short"

    ```gherkin
    Then the command result has "title" is Groceries
    Then the command result has "body" is "Milk, eggs"
    ```

=== "Full"

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

The first argument is a real [JMESPath](https://jmespath.org/)
expression against the parsed JSON body — a flat key is the common case,
but dotted paths and quoted keys with special characters work exactly
as they do in [assertion tables](../concepts/bdd-conventions.md#jmespath-queries),
with zero special-casing:

=== "Flat key"

    ```gherkin
    When I send a POST request to Endpoint known as "<NotesApi>" path "/notes/" with:
      | TYPE  | KEY   | VALUE     |
      | FIELD | title | Groceries |
    Given the value at "id" from the last response is known as "<NoteId>"
    When I send a GET request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    ```

=== "Array index"

    ```gherkin
    When I send a GET request to Endpoint known as "<AuthApi>" path "/.well-known/openid-configuration"
    Then the response status is 200
    Given the value at "response_types_supported[0]" from the last response is known as "<GrantType>"
    ```

    Array indexing works the same way it does in assertion tables — see
    [Array Projection](../concepts/bdd-conventions.md#array-projection).

!!! note "Nested JSON and quoted keys work identically — no REST fixture response happens to nest one"
    A genuinely dotted path (`"user.profile.id"`) or a key containing
    `.`/`/` needing quotes works exactly the same way here — this
    project's REST fixture's JSON responses just don't happen to nest
    that deeply today. The same `query()` function (real
    [JMESPath](https://jmespath.org/), not a custom parser) already
    proves both against real nested Kubernetes/Helm YAML output in [BDD
    conventions: JMESPath
    Queries](../concepts/bdd-conventions.md#quoted-identifiers) — JSON is
    valid YAML, so the exact same code path handles a response body with
    zero special-casing.

### Capture a Response Header

```gherkin
Given the value of response header {string} from the last response is known as {string}
```

Stores a response header's raw value:

```gherkin
When I send a GET request to Endpoint known as "<AuthApi>" path "/oauth/authorize" with:
  | TYPE  | KEY          | VALUE                            |
  | QUERY | client_id    | thomas-client                   |
  | QUERY | redirect_uri | https://client.example/callback  |
  | QUERY | response_type | code                             |
  | QUERY | username     | phase3-user                      |
  | QUERY | password     | secret                           |
Then the response status is 302
Given the value of response header "location" from the last response is known as "<RedirectLocation>"
```

### Capture a Query Parameter from a Header

```gherkin
Given the query parameter {string} from response header {string} is known as {string}
```

Extracts one query parameter out of a header's URL value — used when the
value you need is embedded in a redirect URL, not the header itself:

```gherkin
When I send a GET request to Endpoint known as "<AuthApi>" path "/oauth/authorize" with:
  | TYPE  | KEY       | VALUE           |
  | QUERY | client_id | thomas-client  |
  | QUERY | username  | phase3-user     |
  | QUERY | password  | secret          |
Then the response status is 302
Given the query parameter "code" from response header "location" is known as "<AuthCode>"
```

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
