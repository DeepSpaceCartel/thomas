Feature: File resource validation (short syntax)

  Scenario: Defining a File
    Given File "<NginxChartFile>" at "./charts/test-nginx-0.1.0.tgz"

  Scenario: Rejecting an unknown property
    Given "<BadFilePayload>" field "xxx" is "./charts/test-nginx-0.1.0.tgz"
    When I attempt to define File known as "<BadFile>" using "<BadFilePayload>"
    Then it should have failed with 'File has no field "xxx"'

  Scenario: Rejecting a nonexistent path
    Given "<MissingFilePayload>" field "path" is "./does-not-exist.tgz"
    When I attempt to define File known as "<MissingFile>" using "<MissingFilePayload>"
    Then it should have failed with 'File does not exist'

  Scenario: Referencing an unregistered File resource from a Helm Chart
    Given "<BadChartPayload>" field "chart" is "<UndefinedFile>"
    When I attempt to define Helm Chart known as "<BadChart>" using "<BadChartPayload>"
    Then it should have failed with 'No Resource registered as "<UndefinedFile>"'

  Scenario: Creating a fresh File on disk with real content
    When I create File known as "<GeneratedFile>" at ".cache/resources-short/created.txt" with:
      """
      hello from a real write
      """
    Given File "<ProofFile>" at ".cache/resources-short/created.txt"
