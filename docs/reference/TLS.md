# TLS

Real `openssl` invocations — nothing here is mocked. A generated CA and
certificate are real, cryptographically valid material on disk
(independently verifiable with `openssl verify`). See [BDD
conventions](../concepts/bdd-conventions.md) for the "define, then act"
pattern this domain builds on, and [Resources:
Directory](RESOURCES.md#directory) for the `create Directory` action
this domain generates into.

This is the **generation** counterpart to the existing k8s TLS
*inspection* capability (cert-manager generates, Thomas inspects — see
[kubectl: TLS certificates](KUBECTL.md)) — here Thomas generates real
CA/certificate material itself, to seed an external app's trust store
for a scenario, not to test cert-manager.

## Self-Signed CA

=== "Short"

    ```gherkin
    Given Self-Signed CA "<Ca>" in "<CaDirectory>"
    ```

=== "Full"

    ```gherkin
    Given Self-Signed CA known as "<Ca>":
      | PROPERTY  | VALUE        |
      | directory | <CaDirectory> |
    ```

Registers the directory a CA lives (or will be generated) in — pure
construction. Real file names (`ca-key.pem`/`ca-cert.pem`) are fixed by
the generating action, not a construction field.

### Generate a Self-Signed CA

```gherkin
When I generate Self-Signed CA known as "<Resource>" in Directory known as "<DirResource>" with:
When I generate Self-Signed CA "<Resource>" in Directory known as "<DirResource>" with {flags}
```

Runs `openssl req -x509 -newkey rsa:2048 -nodes -keyout
<dir>/ca-key.pem -out <dir>/ca-cert.pem ...args`. The four structural
flags (`-x509`, `-newkey rsa:2048`, `-keyout`, `-out`) are fixed — they
determine the real, well-known output filenames this alias is
constructed from. Everything else (`-days`, `-subj`, ...) is real,
table-driven `openssl` argv.

```gherkin
When I create Directory known as "<CaDirectory>" at ".cache/ca"
And I generate Self-Signed CA "<Ca>" in Directory known as "<CaDirectory>" with -days 2 -subj /CN=my-test-ca
Then the command exited with 0
```

## TLS Certificate

Same construction shape as `Self-Signed CA` (one field, `directory`;
fixed real file names `tls-key.pem`/`tls-cert.pem`).

### Generate a TLS Certificate signed by a Self-Signed CA

```gherkin
When I generate TLS Certificate known as "<Resource>" in Directory known as "<DirResource>" signed by Self-Signed CA known as "<CaResource>" with:
```

A real 2-step chain, two sequential real `openssl` calls (never a shell
`&&`):
1. `openssl req -new -newkey rsa:2048 -nodes -keyout <dir>/tls-key.pem
   -out <dir>/tls.csr ...args` — the table's `OPTION|VALUE` rows apply
   here (e.g. `-subj`, `-addext subjectAltName=...`).
2. `openssl x509 -req -in <dir>/tls.csr -CA <ca-cert> -CAkey <ca-key>
   -CAcreateserial -copy_extensions copyall -days 2 -out
   <dir>/tls-cert.pem` — fixed (not table-driven): `-copy_extensions
   copyall` carries any `-addext` from the CSR (e.g. a SAN) into the
   final cert, since `openssl x509 -req` doesn't do this by default and
   this avoids needing a separate SAN extfile.

`lastCommandResult` holds the *signing* step's result (the one that
produces the real, final `tls-cert.pem`) — its diagnostic output
(`Certificate request self-signature ok`, `subject=...`) goes to
**STDERR**, not STDOUT.

```gherkin
When I create Directory known as "<CertDirectory>" at ".cache/cert"
And I generate TLS Certificate known as "<Cert>" in Directory known as "<CertDirectory>" signed by Self-Signed CA known as "<Ca>" with:
  | OPTION  | VALUE                              |
  | -subj   | /CN=my-service                     |
  | -addext | subjectAltName=DNS:my-service.local |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                  |
  | STDERR | contains  | Certificate request self-signature ok |
```

## Assertions

No new `Then` vocabulary — reuse `common.step.ts`'s generic exit-code/
output assertions.
