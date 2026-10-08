Feature: BDD Framework for SSH Key Pairs (full table syntax)
  As a platform engineer
  I want to generate a real SSH key pair and discover a real host key
  using the full PROPERTY|VALUE / OPTION|VALUE table forms
  So that I can seed a fixture app's real trust material, with every
  field spelled out explicitly

  Scenario: Generating an SSH Key Pair
    When I create Directory known as "<KeypairDirectory>" at ".cache/ssh-full"
    And I generate SSH Key Pair known as "<Keypair>" in Directory known as "<KeypairDirectory>" with:
      | OPTION | VALUE                     |
      | -t     | ed25519                   |
      | -f     | .cache/ssh-full/id_ed25519 |
      | -N     |                           |
      | -C     | thomas-ssh-full-fixture   |
    Then the command exited with 0
    # Real proof the keypair really was written: reference the real
    # public key file it produced (File's own fs.existsSync check).
    Given File known as "<PublicKey>":
      | PROPERTY | VALUE                          |
      | path     | .cache/ssh-full/id_ed25519.pub |

    # A real, single-line, trimmed capture of the key's own content -
    # the form a fixture chart's `--set-string sshAuthorizedKey=...`
    # actually needs (a raw `--set-file` of the same path reads the
    # file's own trailing newline into the value, which breaks certain
    # charts - see captureFileContent's own comment).
    Given the content of file at ".cache/ssh-full/id_ed25519.pub" is known as "<PublicKeyContent>"
    Then the value known as "<PublicKeyContent>" contains "ssh-ed25519"
    Then the value known as "<PublicKeyContent>" contains "thomas-ssh-full-fixture"
    Then the value known as "<PublicKeyContent>" not_equals ""

  Scenario: Scanning a real SSH host key
    # The scan target goes through the same soft substitution a --set/
    # table VALUE cell gets elsewhere - a real scan target is very often
    # a namespace-dependent Service DNS name (a captured value), not a
    # fixed literal.
    Given the value "github.com" is known as "<ScanHost>"
    When I scan the SSH host key for "<ScanHost>" with:
      | OPTION | VALUE   |
      | -t     | ed25519 |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE      |
      | STDOUT | contains  | github.com |

    # The raw, un-parsed capture - this real host-key line is plain
    # text, not JSON/YAML, so there's nothing to JMESPath-query.
    Given the STDOUT of the last command is known as "<HostKeyLine>"
    Then the value known as "<HostKeyLine>" contains "github.com"
    Then the value known as "<HostKeyLine>" contains "ssh-ed25519"
