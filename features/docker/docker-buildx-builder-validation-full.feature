Feature: Docker Buildx Builder validation (full syntax)

  Scenario: Defining a Docker Buildx Builder
    Given Docker Buildx Builder known as "<LocalBuilder>":
      | PROPERTY | VALUE                       |
      | name     | thomas-validation-builder   |
      | endpoint | tcp://127.0.0.1:1234        |

  Scenario: Rejecting an unknown property
    When I attempt to define Docker Buildx Builder known as "<BadBuilder>":
      | PROPERTY | VALUE |
      | xxx      | yyy   |
    Then it should have failed with 'DockerBuildxBuilder has no field "xxx"'

  Scenario: Rejecting a missing name
    When I attempt to define Docker Buildx Builder known as "<NoNameBuilder>":
      | PROPERTY | VALUE                |
      | endpoint | tcp://127.0.0.1:1234 |
    Then it should have failed with 'DockerBuildxBuilder requires a "name" field'

  Scenario: Rejecting a missing endpoint
    When I attempt to define Docker Buildx Builder known as "<NoEndpointBuilder>":
      | PROPERTY | VALUE                     |
      | name     | thomas-validation-builder |
    Then it should have failed with 'DockerBuildxBuilder requires an "endpoint" field'

  Scenario: Referencing an unregistered Resource for the endpoint
    When I attempt to define Docker Buildx Builder known as "<BadBuilder>":
      | PROPERTY | VALUE                     |
      | name     | thomas-validation-builder |
      | endpoint | <UndefinedEndpoint>       |
    Then it should have failed with 'No Resource registered as "<UndefinedEndpoint>"'
