Feature: File resource validation (full syntax)

  Scenario: Defining a File
    Given File known as "<NginxChartFile>":
      | PROPERTY | VALUE                    |
      | path     | ./charts/test-nginx-0.1.0.tgz |

  Scenario: Rejecting an unknown property
    When I attempt to define File known as "<BadFile>":
      | PROPERTY | VALUE                    |
      | xxx      | ./charts/test-nginx-0.1.0.tgz |
    Then it should have failed with 'File has no field "xxx"'

  Scenario: Rejecting a nonexistent path
    When I attempt to define File known as "<MissingFile>":
      | PROPERTY | VALUE                |
      | path     | ./does-not-exist.tgz |
    Then it should have failed with 'File does not exist'

  Scenario: Referencing an unregistered File resource from a Helm Chart
    When I attempt to define Helm Chart known as "<BadChart>":
      | PROPERTY | VALUE           |
      | chart    | <UndefinedFile> |
    Then it should have failed with 'No Resource registered as "<UndefinedFile>"'

  Scenario: Creating a fresh File on disk with real content
    When I create File known as "<GeneratedFile>" at ".cache/resources-full/created.txt" with:
      """
      hello from a real write
      """
    # Re-declaring a File against the same real path proves the write
    # really happened - Given's own constructor does a real fs.existsSync
    # check and throws if it isn't there.
    Given File known as "<ProofFile>":
      | PROPERTY | VALUE                              |
      | path     | .cache/resources-full/created.txt |

  # Same real motivation as Directory's own "built from a captured value"
  # scenario - a worker-scoped fixture path (CUCUMBER_WORKER_ID under
  # --parallel) is a captured value embedded inside a literal path here
  # too, distinct from `content` (already strictly substituted).
  Scenario: Creating a fresh File at a path built from a captured value
    Given the value "created-from-capture.txt" is known as "<CapturedSuffix>"
    When I create File known as "<CapturedPathFile>" at ".cache/resources-full/<CapturedSuffix>" with:
      """
      hello from a captured path
      """
    Given File known as "<CapturedPathProofFile>":
      | PROPERTY | VALUE                                          |
      | path     | .cache/resources-full/created-from-capture.txt |
