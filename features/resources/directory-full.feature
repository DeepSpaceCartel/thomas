Feature: Directory resource validation (full syntax)

  Scenario: Defining a Directory
    Given Directory known as "<ChartsDirectory>":
      | PROPERTY | VALUE    |
      | path     | ./charts |

  Scenario: Rejecting an unknown property
    When I attempt to define Directory known as "<BadDirectory>":
      | PROPERTY | VALUE    |
      | xxx      | ./charts |
    Then it should have failed with 'Directory has no field "xxx"'

  Scenario: Rejecting a nonexistent path
    When I attempt to define Directory known as "<MissingDirectory>":
      | PROPERTY | VALUE            |
      | path     | ./does-not-exist |
    Then it should have failed with 'Directory does not exist'

  Scenario: Referencing an unregistered Directory resource from a Helm Chart
    When I attempt to define Helm Chart known as "<BadChart>":
      | PROPERTY | VALUE                |
      | chart    | <UndefinedDirectory> |
    Then it should have failed with 'No Resource registered as "<UndefinedDirectory>"'

  Scenario: Creating a fresh Directory on disk
    When I create Directory known as "<GeneratedDirectory>" at ".cache/resources-full/created"
    # Re-declaring a Directory against the same real path proves the mkdir
    # really happened - Given's own constructor does a real fs.existsSync
    # check and throws if it isn't there.
    Given Directory known as "<ProofDirectory>":
      | PROPERTY | VALUE                          |
      | path     | .cache/resources-full/created |

  # A worker-scoped fixture path (the real motivating case: cucumber-js's
  # own CUCUMBER_WORKER_ID under --parallel) is a captured value embedded
  # in the middle of a literal path, not a bare "<Alias>" the way an
  # `endpoint`/Resource reference already works - proves the path argument
  # itself gets soft-substituted, not just table cells elsewhere.
  Scenario: Creating a fresh Directory at a path built from a captured value
    Given the value "created-from-capture" is known as "<CapturedSuffix>"
    When I create Directory known as "<CapturedPathDirectory>" at ".cache/resources-full/<CapturedSuffix>"
    Given Directory known as "<CapturedPathProofDirectory>":
      | PROPERTY | VALUE                                       |
      | path     | .cache/resources-full/created-from-capture |
