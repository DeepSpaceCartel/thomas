Feature: Helm Release validation (short syntax)

  Scenario: Defining a Helm Release
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "thomas-nginx" in "thomas-helm-test"

  Scenario: Rejecting an unknown property
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    Given "<BadReleasePayload>" field "chart" is "<NginxHelmChart>"
    And "<BadReleasePayload>" field "name" is "thomas-nginx"
    And "<BadReleasePayload>" field "namespace" is "thomas-helm-test"
    And "<BadReleasePayload>" field "xxx" is "yyy"
    When I attempt to define Helm Release known as "<BadRelease>" using "<BadReleasePayload>"
    Then it should have failed with 'HelmRelease has no field "xxx"'

  Scenario: Rejecting a missing name
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    Given "<NoNameReleasePayload>" field "chart" is "<NginxHelmChart>"
    And "<NoNameReleasePayload>" field "namespace" is "thomas-helm-test"
    When I attempt to define Helm Release known as "<NoNameRelease>" using "<NoNameReleasePayload>"
    Then it should have failed with 'HelmRelease requires a "name" field'

  Scenario: Rejecting a missing namespace
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    Given "<NoNamespaceReleasePayload>" field "chart" is "<NginxHelmChart>"
    And "<NoNamespaceReleasePayload>" field "name" is "thomas-nginx"
    When I attempt to define Helm Release known as "<NoNamespaceRelease>" using "<NoNamespaceReleasePayload>"
    Then it should have failed with 'HelmRelease requires a "namespace" field'

  Scenario: Rejecting a missing chart
    Given "<NoChartReleasePayload>" field "name" is "thomas-nginx"
    And "<NoChartReleasePayload>" field "namespace" is "thomas-helm-test"
    When I attempt to define Helm Release known as "<NoChartRelease>" using "<NoChartReleasePayload>"
    Then it should have failed with 'HelmRelease requires a "chart" field'

  Scenario: Referencing an unregistered HelmChart resource from a Helm Release
    Given "<BadRelease2Payload>" field "chart" is "<UndefinedHelmChart>"
    And "<BadRelease2Payload>" field "name" is "thomas-nginx"
    And "<BadRelease2Payload>" field "namespace" is "thomas-helm-test"
    When I attempt to define Helm Release known as "<BadRelease>" using "<BadRelease2Payload>"
    Then it should have failed with 'No HelmChart registered as "<UndefinedHelmChart>"'
