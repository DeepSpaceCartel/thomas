Feature: Docker Buildx Builder validation (short syntax)

  Scenario: Defining a Docker Buildx Builder
    Given Docker Buildx Builder "<LocalBuilder>" named "thomas-validation-builder" at "tcp://127.0.0.1:1234"

  Scenario: Rejecting an unknown property
    Given "<BadBuilderPayload>" field "xxx" is "yyy"
    When I attempt to define Docker Buildx Builder known as "<BadBuilder>" using "<BadBuilderPayload>"
    Then it should have failed with 'DockerBuildxBuilder has no field "xxx"'

  Scenario: Rejecting a missing name
    Given "<NoNameBuilderPayload>" field "endpoint" is "tcp://127.0.0.1:1234"
    When I attempt to define Docker Buildx Builder known as "<NoNameBuilder>" using "<NoNameBuilderPayload>"
    Then it should have failed with 'DockerBuildxBuilder requires a "name" field'

  Scenario: Rejecting a missing endpoint
    Given "<NoEndpointBuilderPayload>" field "name" is "thomas-validation-builder"
    When I attempt to define Docker Buildx Builder known as "<NoEndpointBuilder>" using "<NoEndpointBuilderPayload>"
    Then it should have failed with 'DockerBuildxBuilder requires an "endpoint" field'

  Scenario: Referencing an unregistered Resource for the endpoint
    Given "<BadBuilderPayload2>" field "name" is "thomas-validation-builder"
    And "<BadBuilderPayload2>" field "endpoint" is "<UndefinedEndpoint>"
    When I attempt to define Docker Buildx Builder known as "<BadBuilder>" using "<BadBuilderPayload2>"
    Then it should have failed with 'No Resource registered as "<UndefinedEndpoint>"'
