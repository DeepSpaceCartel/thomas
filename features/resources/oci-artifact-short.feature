Feature: OCI Artifact resource validation (short syntax)

  Scenario: Defining an OCI Artifact
    Given OCI Artifact "<NginxOciArtifact>" at "oci://registry-1.docker.io/bitnamicharts/nginx"

  Scenario: Rejecting an unknown property
    Given "<BadOciPayload>" field "xxx" is "oci://example.com/charts/x"
    When I attempt to define OCI Artifact known as "<BadOci>" using "<BadOciPayload>"
    Then it should have failed with 'OCIArtifact has no field "xxx"'

  Scenario: Rejecting a ref without the oci:// prefix
    Given "<NotOciPayload>" field "ref" is "https://example.com/charts"
    When I attempt to define OCI Artifact known as "<NotOci>" using "<NotOciPayload>"
    Then it should have failed with 'OCIArtifact ref must start with "oci://"'

  Scenario: Referencing an unregistered OCI Artifact resource from a Helm Chart
    Given "<BadChartPayload>" field "chart" is "<UndefinedOciArtifact>"
    When I attempt to define Helm Chart known as "<BadChart>" using "<BadChartPayload>"
    Then it should have failed with 'No Resource registered as "<UndefinedOciArtifact>"'
