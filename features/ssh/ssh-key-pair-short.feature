Feature: BDD Framework for SSH Key Pairs (short syntax)
  As a platform engineer
  I want to generate a real SSH key pair and discover a real host key
  using the short oneline and `with <flags>` forms
  So that I can seed a fixture app's real trust material, reading the
  least amount of Gherkin necessary to do it

  Scenario: Generating an SSH Key Pair
    When I create Directory known as "<KeypairDirectory>" at ".cache/ssh-short"
    And I generate SSH Key Pair "<Keypair>" in Directory known as "<KeypairDirectory>" with -t ed25519 -f .cache/ssh-short/id_ed25519 -N "" -C thomas-ssh-short-fixture
    Then the command exited with 0
    Given File "<PublicKey>" at ".cache/ssh-short/id_ed25519.pub"

  Scenario: Scanning a real SSH host key
    When I scan the SSH host key for "github.com" with -t ed25519
    Then the command exited with 0 STDOUT contains github.com
