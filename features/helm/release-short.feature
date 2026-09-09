Feature: BDD Framework for Helm Releases (short syntax)
  As a DevOps engineer
  I want to install, inspect, and roll back real Helm releases on a real
  cluster using the short oneline and `with <flags>` forms
  So that I can functionally test a chart's actual deployed behavior,
  reading the least amount of Gherkin necessary to do it

  Scenario: Installing, inspecting, testing, and uninstalling a HelmRelease
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "thomas-nginx-release" in "thomas-helm-test"
    When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
    Then the command exited with 0
    When I get status of Helm Release "<NginxRelease>" as YAML
    Then Helm Release "<NginxRelease>" is "deployed"
    When I get history of Helm Release "<NginxRelease>" as YAML
    Then the command result has "[*].status" is deployed
    When I get values for Helm Release "<NginxRelease>" with --all --output yaml
    Then the command result has "replicaCount" is 1
    When I list Helm Release with --namespace thomas-helm-test --output yaml
    Then the command result has "[*].name" is thomas-nginx-release
    When I get metadata for Helm Release "<NginxRelease>" as YAML
    Then the command result has "name" is thomas-nginx-release
    Then the command result has "chart" is test-nginx
    When I get hooks for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains "helm.sh/hook\": test"
    When I get manifest for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains "# Source: test-nginx/templates/service.yaml"
    When I get notes for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains "Access it:"
    When I get all for Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains NOTES:
    Then the command exited with 0 STDOUT contains "# Source: test-nginx/templates/service.yaml"
    When I test Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains Succeeded
    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains uninstalled

  Scenario: Rolling back a HelmRelease to a previous revision
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Release "<RollbackRelease>" of "<NginxHelmChart>" named "thomas-rollback-release" in "thomas-helm-test"
    When I upgrade Helm Release "<RollbackRelease>" with --install --create-namespace
    Then the command exited with 0
    When I upgrade Helm Release "<RollbackRelease>" with --set replicaCount=2
    Then the command exited with 0
    When I rollback Helm Release "<RollbackRelease>" with 1
    Then the command exited with 0 STDOUT contains "Rollback was a success"
    When I uninstall Helm Release known as "<RollbackRelease>"
    Then the command exited with 0

  Scenario: Rejecting a duplicate install
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Release "<DuplicateRelease>" of "<NginxHelmChart>" named "thomas-duplicate-release" in "thomas-helm-test"
    When I install Helm Release "<DuplicateRelease>" with --create-namespace
    Then the command exited with 0
    When I install Helm Release known as "<DuplicateRelease>"
    Then the command exited with 1 STDERR contains "cannot re-use a name"
    When I uninstall Helm Release known as "<DuplicateRelease>"
    Then the command exited with 0
