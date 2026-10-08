Feature: SSH Key Pair validation (short syntax)

  Scenario: Defining an SSH Key Pair
    Given Directory "<KeypairDirectory>" at "./fixtures/ssh"
    And SSH Key Pair "<Keypair>" in "<KeypairDirectory>"

  Scenario: Rejecting an unknown property
    Given "<BadKeypairPayload>" field "xxx" is "yyy"
    When I attempt to define SSH Key Pair known as "<BadKeypair>" using "<BadKeypairPayload>"
    Then it should have failed with 'SshKeyPair has no field "xxx"'

  Scenario: Rejecting a nonexistent directory
    Given "<MissingDirKeypairPayload>" field "directory" is "./does-not-exist"
    When I attempt to define SSH Key Pair known as "<MissingDirKeypair>" using "<MissingDirKeypairPayload>"
    Then it should have failed with 'SshKeyPair directory does not exist'

  Scenario: Referencing an unregistered Directory resource
    Given "<BadKeypairPayload2>" field "directory" is "<UndefinedDirectory>"
    When I attempt to define SSH Key Pair known as "<BadKeypair>" using "<BadKeypairPayload2>"
    Then it should have failed with 'No Resource registered as "<UndefinedDirectory>"'
