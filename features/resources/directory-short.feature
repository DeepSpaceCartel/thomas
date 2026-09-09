Feature: Directory resource validation (short syntax)

  Scenario: Defining a Directory
    Given Directory "<ChartsDirectory>" at "./charts"

  Scenario: Rejecting an unknown property
    Given "<BadDirectoryPayload>" field "xxx" is "./charts"
    When I attempt to define Directory known as "<BadDirectory>" using "<BadDirectoryPayload>"
    Then it should have failed with 'Directory has no field "xxx"'

  Scenario: Rejecting a nonexistent path
    Given "<MissingDirectoryPayload>" field "path" is "./does-not-exist"
    When I attempt to define Directory known as "<MissingDirectory>" using "<MissingDirectoryPayload>"
    Then it should have failed with 'Directory does not exist'

  Scenario: Referencing an unregistered Directory resource from a Helm Chart
    Given "<BadChartPayload>" field "chart" is "<UndefinedDirectory>"
    When I attempt to define Helm Chart known as "<BadChart>" using "<BadChartPayload>"
    Then it should have failed with 'No Resource registered as "<UndefinedDirectory>"'
