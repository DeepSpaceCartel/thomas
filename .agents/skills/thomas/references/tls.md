# TLS steps

Real `openssl` invocations — the generation counterpart to the existing
k8s TLS *inspection* capability (`kubectl.md`'s certificate inspection:
cert-manager generates, Thomas inspects; here Thomas also generates, to
seed an external app's trust store). See [`../SKILL.md`](../SKILL.md)
first for the general pattern this extends, and
[`extending.md`](extending.md) for the underlying Alias/DataTable
methodology.

## The two TLS-domain types

- **`Self-Signed CA`** (`support/tls/self_signed_ca.ts`, class
  `SelfSignedCa`) — a directory holding `ca-key.pem`/`ca-cert.pem`.
- **`TLS Certificate`** (`support/tls/tls_certificate.ts`, class
  `TlsCertificate`) — a directory holding `tls-key.pem`/`tls-cert.pem`.

Both: one real field (`directory`), fixed real file names (so the alias
is re-discoverable from just the directory afterward).

## Steps

```gherkin
Given Self-Signed CA "<Alias>" in "<DirAlias>"
Given Self-Signed CA known as "<Alias>":                         # PROPERTY|VALUE: directory
When I generate Self-Signed CA known as "<Alias>" in Directory known as "<DirAlias>" with:   # real openssl req -x509
When I generate Self-Signed CA "<Alias>" in Directory known as "<DirAlias>" with {flags}

Given TLS Certificate "<Alias>" in "<DirAlias>"
Given TLS Certificate known as "<Alias>":
When I generate TLS Certificate known as "<Alias>" in Directory known as "<DirAlias>" signed by Self-Signed CA known as "<CaAlias>" with:   # real 2-step CSR + sign chain
```

`generate Self-Signed CA`'s structural flags (`-x509`, `-newkey
rsa:2048`, `-keyout`, `-out`) are fixed; everything else (`-days`,
`-subj`) is table-driven. `generate TLS Certificate` is a real 2-step
chain (CSR via `openssl req`, sign via `openssl x509 -req
-copy_extensions copyall`) — the table applies to the CSR step only;
the signing step is fixed (`-CAcreateserial -copy_extensions copyall
-days 2`), so any `-addext` (e.g. a SAN) on the CSR carries through to
the final cert without a separate extfile. **Diagnostic output
(`Certificate request self-signature ok`) goes to STDERR, not STDOUT.**

No new assertion vocabulary — every action sets `lastCommandResult`,
reuse `common.step.ts`'s generic `Then` steps.

**In practice**:

```gherkin
When I create Directory known as "<CaDir>" at ".cache/ca"
And I generate Self-Signed CA "<Ca>" in Directory known as "<CaDir>" with -days 2 -subj /CN=test-ca
Then the command exited with 0
When I create Directory known as "<CertDir>" at ".cache/cert"
And I generate TLS Certificate known as "<Cert>" in Directory known as "<CertDir>" signed by Self-Signed CA known as "<Ca>" with:
  | OPTION  | VALUE                              |
  | -subj   | /CN=my-service                     |
  | -addext | subjectAltName=DNS:my-service.local |
Then the command exited with 0:
  | SOURCE | CONDITION | VALUE                                  |
  | STDERR | contains  | Certificate request self-signature ok |
```
