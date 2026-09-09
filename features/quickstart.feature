Feature: Quick Start - the shape of a scenario a consuming project writes
  As a developer evaluating Thomas
  I want one scenario that deploys a chart from a local folder, verifies
  it in Kubernetes, then makes a real REST check against it
  So that I can see the full Helm -> Kubernetes -> REST flow in one place
  before reading the per-tool references

  # Uses this repo's own charts/nginx fixture as a stand-in for "your
  # chart" - every alias/step here is real and proven elsewhere in this
  # suite; this scenario exists specifically to back docs/index.md's
  # Quick Start section with a real, passing example.
  Scenario: Deploy a chart from a folder, verify it in k8s, then check it over REST
    Given Directory known as "<MyChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    And Helm Chart known as "<MyHelmChart>":
      | PROPERTY | VALUE               |
      | chart    | <MyChartDirectory> |
    And HelmRelease known as "<MyRelease>":
      | PROPERTY  | VALUE             |
      | chart     | <MyHelmChart>     |
      | name      | sandbox-quickstart |
      | namespace | thomas-helm-test  |
    When I upgrade HelmRelease known as "<MyRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    Given Deployment known as "<MyDeployment>":
      | PROPERTY                   | VALUE               |
      | namespace                  | thomas-helm-test    |
      | app.kubernetes.io/instance | sandbox-quickstart  |
    When I get Deployment known as "<MyDeployment>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY                  | CONDITION | VALUE |
      | status.readyReplicas | gte       | 1     |

    Given Service known as "<MyService>":
      | PROPERTY                   | VALUE              |
      | namespace                  | thomas-helm-test   |
      | app.kubernetes.io/instance | sandbox-quickstart |
    And RestEndpoint known as "<MyApi>":
      | PROPERTY | VALUE       |
      | service  | <MyService> |
      | port     | 80          |
    When I send a GET request to RestEndpoint known as "<MyApi>" path "/"
    Then the response status is 200

    When I uninstall HelmRelease known as "<MyRelease>"
    Then the command exited with 0
