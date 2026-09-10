Feature: BDD Framework for Helm Releases (full table syntax)
  As a DevOps engineer
  I want to install, inspect, and roll back real Helm releases on a real
  cluster using the full PROPERTY|VALUE / OPTION|VALUE table forms
  So that I can functionally test a chart's actual deployed behavior,
  with every field spelled out explicitly

  Scenario: Installing, inspecting, testing, and uninstalling a HelmRelease
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Release known as "<NginxRelease>":
      | PROPERTY  | VALUE                 |
      | chart     | <NginxHelmChart>      |
      | name      | thomas-nginx-release  |
      | namespace | thomas-helm-test      |
    When I upgrade Helm Release known as "<NginxRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0
    When I status Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY         | CONDITION | VALUE    |
      | info.status | equals    | deployed |
    When I history Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY        | CONDITION | VALUE    |
      | [*].status | equals    | deployed |
    When I get values for Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --all    | True  |
      | --output | yaml  |
    Then the command result data has:
      | KEY          | CONDITION | VALUE |
      | replicaCount | equals    | 1     |
    When I list Helm Release with:
      | OPTION      | VALUE            |
      | --namespace | thomas-helm-test |
      | --output    | yaml             |
    Then the command result data has:
      | KEY      | CONDITION | VALUE                 |
      | [*].name | equals    | thomas-nginx-release |
    When I get metadata for Helm Release known as "<NginxRelease>" with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY   | CONDITION | VALUE                 |
      | name  | equals    | thomas-nginx-release |
      | chart | equals    | test-nginx            |
    When I get hooks for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                |
      | STDOUT | contains  | helm.sh/hook": test  |
    When I get manifest for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                       |
      | STDOUT | contains  | # Source: test-nginx/templates/service.yaml |
    When I get notes for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE      |
      | STDOUT | contains  | Access it: |
    When I get all for Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                       |
      | STDOUT | contains  | NOTES:                                       |
      | STDOUT | contains  | # Source: test-nginx/templates/service.yaml |
    When I test Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE     |
      | STDOUT | contains  | Succeeded |
    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE       |
      | STDOUT | contains  | uninstalled |

  Scenario: Rolling back a HelmRelease to a previous revision
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Release known as "<RollbackRelease>":
      | PROPERTY  | VALUE                    |
      | chart     | <NginxHelmChart>         |
      | name      | thomas-rollback-release  |
      | namespace | thomas-helm-test         |
    When I upgrade Helm Release known as "<RollbackRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --create-namespace | True  |
    Then the command exited with 0
    When I upgrade Helm Release known as "<RollbackRelease>" with:
      | OPTION | VALUE          |
      | --set  | replicaCount=2 |
    Then the command exited with 0
    When I rollback Helm Release known as "<RollbackRelease>" with:
      | OPTION | VALUE |
      |        | 1     |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                  |
      | STDOUT | contains  | Rollback was a success |
    When I uninstall Helm Release known as "<RollbackRelease>"
    Then the command exited with 0

  Scenario: Rejecting a duplicate install
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Release known as "<DuplicateRelease>":
      | PROPERTY  | VALUE                    |
      | chart     | <NginxHelmChart>         |
      | name      | thomas-duplicate-release |
      | namespace | thomas-helm-test         |
    When I install Helm Release known as "<DuplicateRelease>" with:
      | OPTION             | VALUE |
      | --create-namespace | True  |
    Then the command exited with 0
    When I install Helm Release known as "<DuplicateRelease>"
    Then the command exited with 1:
      | SOURCE | CONDITION | VALUE                |
      | STDERR | contains  | cannot reuse a name  |
    When I uninstall Helm Release known as "<DuplicateRelease>"
    Then the command exited with 0
