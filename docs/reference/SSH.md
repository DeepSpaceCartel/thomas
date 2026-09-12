# SSH

Real `ssh-keygen`/`ssh-keyscan` invocations — nothing here is mocked. A
generated key pair is a real, valid keypair on disk; a host-key scan is
a real network probe. See [BDD
conventions](../concepts/bdd-conventions.md) for the "define, then act"
pattern this domain builds on, and [Resources:
Directory](RESOURCES.md#directory) for the `create Directory` action
this domain generates into.

This domain covers only the **test-fixture-generation** side: producing
real key material and discovering a real host key for a scenario to
feed to the app under test. Consuming that material (e.g. host-key
pinning/trust-on-first-use policy) is real business logic that belongs
in the application being tested, not in Thomas.

## SSH Key Pair

=== "Short"

    ```gherkin
    Given SSH Key Pair "<Keypair>" in "<KeypairDirectory>"
    ```

=== "Full"

    ```gherkin
    Given SSH Key Pair known as "<Keypair>":
      | PROPERTY  | VALUE               |
      | directory | <KeypairDirectory> |
    ```

Registers the directory a key pair lives (or will be generated) in —
pure construction, no `ssh-keygen` call. `SshKeyPair` has exactly one
real field (`directory`); negative-path tests use the same [Payload
accumulator](../concepts/bdd-conventions.md#construction) shape as
`Directory`/`File`.

### Generate an SSH Key Pair

```gherkin
When I generate SSH Key Pair known as "<Resource>" in Directory known as "<DirResource>" with:
When I generate SSH Key Pair "<Resource>" in Directory known as "<DirResource>" with {flags}
```

Runs `ssh-keygen` with whatever `OPTION|VALUE` rows (or `{flags}`) the
scenario supplies — every real `ssh-keygen` argument (`-t`, `-f`, `-N`,
`-C`, ...) is table-driven, nothing is implied by step text. `-f` is
required: it's both the real key path `ssh-keygen` writes to and what
this step reads back to construct the `SshKeyPair` alias once
generation succeeds. Force-overwrites first (`rm -f <path> <path>.pub`
as a real, separate command — never a shell `&&`) so a re-run always
generates fresh material rather than trusting stale files.

=== "Short"

    ```gherkin
    When I create Directory known as "<KeypairDirectory>" at ".cache/ssh"
    And I generate SSH Key Pair "<Keypair>" in Directory known as "<KeypairDirectory>" with -t ed25519 -f .cache/ssh/id_ed25519 -N "" -C my-fixture
    Then the command exited with 0
    ```

=== "Full"

    ```gherkin
    When I create Directory known as "<KeypairDirectory>" at ".cache/ssh"
    And I generate SSH Key Pair known as "<Keypair>" in Directory known as "<KeypairDirectory>" with:
      | OPTION | VALUE                 |
      | -t     | ed25519               |
      | -f     | .cache/ssh/id_ed25519 |
      | -N     |                       |
      | -C     | my-fixture            |
    Then the command exited with 0
    ```

### Scan a real SSH host key

```gherkin
When I scan the SSH host key for "<host>" with:
When I scan the SSH host key for "<host>" with {flags}
When I scan the SSH host key for "<host>"
```

Stateless — runs `ssh-keyscan <args> <host>`, no alias registered.
Assert on the real result via the existing raw-text `SOURCE|CONDITION|VALUE`
vocabulary against `STDOUT`.

```gherkin
When I scan the SSH host key for "github.com" with -t ed25519
Then the command exited with 0 STDOUT contains github.com
```

## Assertions

No new `Then` vocabulary — reuse `common.step.ts`'s generic exit-code/
output assertions the same way every other domain does.
