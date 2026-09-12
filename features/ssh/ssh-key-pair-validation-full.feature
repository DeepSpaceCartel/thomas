Feature: SSH Key Pair validation (full syntax)

  Scenario: Defining an SSH Key Pair
    Given Directory "<KeypairDirectory>" at "./fixtures/ssh"
    And SSH Key Pair known as "<Keypair>":
      | PROPERTY  | VALUE               |
      | directory | <KeypairDirectory> |

  Scenario: Rejecting an unknown property
    When I attempt to define SSH Key Pair known as "<BadKeypair>":
      | PROPERTY | VALUE |
      | xxx      | yyy   |
    Then it should have failed with 'SshKeyPair has no field "xxx"'

  Scenario: Rejecting a nonexistent directory
    When I attempt to define SSH Key Pair known as "<MissingDirKeypair>":
      | PROPERTY  | VALUE            |
      | directory | ./does-not-exist |
    Then it should have failed with 'SshKeyPair directory does not exist'

  Scenario: Referencing an unregistered Directory resource
    When I attempt to define SSH Key Pair known as "<BadKeypair>":
      | PROPERTY  | VALUE                 |
      | directory | <UndefinedDirectory> |
    Then it should have failed with 'No Resource registered as "<UndefinedDirectory>"'
