# SSH steps

Real `ssh-keygen`/`ssh-keyscan` invocations — test-fixture generation
only (a real keypair, a real host-key scan), not host-key trust policy
(that's the application under test's own business logic). See
[`../SKILL.md`](../SKILL.md) first for the general pattern this
extends, and [`extending.md`](extending.md) for the underlying
Alias/DataTable methodology.

## The one SSH-domain type

- **`SSH Key Pair`** (`support/ssh/ssh_key_pair.ts`, class `SshKeyPair`)
  — the directory a keypair lives in (`directory`, one real field, no
  live check besides the directory's own real existence — same shape
  as `Directory`/`File`).

## Steps

```gherkin
Given SSH Key Pair "<Alias>" in "<DirAlias>"
Given SSH Key Pair known as "<Alias>":                       # PROPERTY|VALUE: directory

When I generate SSH Key Pair known as "<Alias>" in Directory known as "<DirAlias>" with:   # real ssh-keygen
When I generate SSH Key Pair "<Alias>" in Directory known as "<DirAlias>" with {flags}

When I scan the SSH host key for "<host>" with:              # real ssh-keyscan, stateless
When I scan the SSH host key for "<host>" with {flags}
When I scan the SSH host key for "<host>"
```

`generate` is fully table/flags-driven (no hardcoded algorithm/comment)
— `-f` is required, since it's both the real path `ssh-keygen` writes
to and what the step reads back to construct the `SshKeyPair` alias.
Force-overwrites first (`rm -f <path> <path>.pub`, a real separate
command, never a shell `&&`) — matches the disposable-k8s-test-fixtures
skill's documented idiom for regenerating key material fresh every run.

No new assertion vocabulary — every action sets `lastCommandResult`,
reuse `common.step.ts`'s generic `Then` steps.

**In practice**:

```gherkin
When I create Directory known as "<Dir>" at ".cache/ssh"
And I generate SSH Key Pair "<Keypair>" in Directory known as "<Dir>" with -t ed25519 -f .cache/ssh/id_ed25519 -N "" -C fixture
Then the command exited with 0
When I scan the SSH host key for "github.com" with -t ed25519
Then the command exited with 0 STDOUT contains github.com
```
