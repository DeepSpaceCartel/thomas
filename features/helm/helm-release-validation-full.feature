Feature: Helm Release validation (full syntax)

  Scenario: Defining a Helm Release
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Release known as "<NginxRelease>":
      | PROPERTY  | VALUE             |
      | chart     | <NginxHelmChart>  |
      | name      | thomas-nginx     |
      | namespace | thomas-helm-test  |

  Scenario: Rejecting an unknown property
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    When I attempt to define Helm Release known as "<BadRelease>":
      | PROPERTY  | VALUE              |
      | chart     | <NginxHelmChart>   |
      | name      | thomas-nginx      |
      | namespace | thomas-helm-test |
      | xxx       | yyy                |
    Then it should have failed with 'HelmRelease has no field "xxx"'

  Scenario: Rejecting a missing name
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    When I attempt to define Helm Release known as "<NoNameRelease>":
      | PROPERTY  | VALUE              |
      | chart     | <NginxHelmChart>   |
      | namespace | thomas-helm-test |
    Then it should have failed with 'HelmRelease requires a "name" field'

  Scenario: Rejecting a missing namespace
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    When I attempt to define Helm Release known as "<NoNamespaceRelease>":
      | PROPERTY | VALUE            |
      | chart    | <NginxHelmChart> |
      | name     | thomas-nginx    |
    Then it should have failed with 'HelmRelease requires a "namespace" field'

  Scenario: Rejecting a missing chart
    When I attempt to define Helm Release known as "<NoChartRelease>":
      | PROPERTY  | VALUE              |
      | name      | thomas-nginx      |
      | namespace | thomas-helm-test |
    Then it should have failed with 'HelmRelease requires a "chart" field'

  Scenario: Referencing an unregistered HelmChart resource from a Helm Release
    When I attempt to define Helm Release known as "<BadRelease>":
      | PROPERTY  | VALUE                 |
      | chart     | <UndefinedHelmChart>  |
      | name      | thomas-nginx         |
      | namespace | thomas-helm-test    |
    Then it should have failed with 'No HelmChart registered as "<UndefinedHelmChart>"'
