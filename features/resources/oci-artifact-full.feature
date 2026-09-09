Feature: OCI Artifact resource validation (full syntax)

  Scenario: Defining an OCI Artifact
    Given OCI Artifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                          |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx |

  Scenario: Rejecting an unknown property
    When I attempt to define OCI Artifact known as "<BadOci>":
      | PROPERTY | VALUE                      |
      | xxx      | oci://example.com/charts/x |
    Then it should have failed with 'OCIArtifact has no field "xxx"'

  Scenario: Rejecting a ref without the oci:// prefix
    When I attempt to define OCI Artifact known as "<NotOci>":
      | PROPERTY | VALUE                       |
      | ref      | https://example.com/charts |
    Then it should have failed with 'OCIArtifact ref must start with "oci://"'

  Scenario: Referencing an unregistered OCI Artifact resource from a Helm Chart
    When I attempt to define Helm Chart known as "<BadChart>":
      | PROPERTY | VALUE                  |
      | chart    | <UndefinedOciArtifact> |
    Then it should have failed with 'No Resource registered as "<UndefinedOciArtifact>"'
