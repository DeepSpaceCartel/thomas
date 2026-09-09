Feature: HelmRelease alias validation

  Scenario: Defining a HelmRelease
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And HelmRelease known as "<NginxRelease>":
      | PROPERTY  | VALUE              |
      | chart     | <NginxHelmChart>   |
      | name      | sandbox-nginx      |
      | namespace | thomas-helm-test |

  Scenario: Rejecting an unknown property
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I attempt to define HelmRelease known as "<BadRelease>":
      | PROPERTY  | VALUE              |
      | chart     | <NginxHelmChart>   |
      | name      | sandbox-nginx      |
      | namespace | thomas-helm-test |
      | xxx       | yyy                |
    Then it should have failed with 'HelmRelease has no field "xxx"'

  Scenario: Rejecting a missing name
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I attempt to define HelmRelease known as "<NoNameRelease>":
      | PROPERTY  | VALUE              |
      | chart     | <NginxHelmChart>   |
      | namespace | thomas-helm-test |
    Then it should have failed with 'HelmRelease requires a "name" field'

  Scenario: Rejecting a missing namespace
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE          |
      | path     | ./charts/nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I attempt to define HelmRelease known as "<NoNamespaceRelease>":
      | PROPERTY | VALUE            |
      | chart    | <NginxHelmChart> |
      | name     | sandbox-nginx    |
    Then it should have failed with 'HelmRelease requires a "namespace" field'

  Scenario: Rejecting a missing chart
    When I attempt to define HelmRelease known as "<NoChartRelease>":
      | PROPERTY  | VALUE              |
      | name      | sandbox-nginx      |
      | namespace | thomas-helm-test |
    Then it should have failed with 'HelmRelease requires a "chart" field'

  Scenario: Referencing an unregistered HelmChart alias from a HelmRelease
    When I attempt to define HelmRelease known as "<BadRelease>":
      | PROPERTY  | VALUE                 |
      | chart     | <UndefinedHelmChart>  |
      | name      | sandbox-nginx         |
      | namespace | thomas-helm-test    |
    Then it should have failed with 'No HelmChart registered as "<UndefinedHelmChart>"'
