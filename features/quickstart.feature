Feature: Deploy and Test a Service
  As a full-stack developer
  I want to deploy a service and check that it is working
  So that I can see a complete service deployment and verification flow

  # Deploys into "dev", not thomas-helm-test - see docs/project/ci.md
  # for why that excludes this scenario from the narrowly-scoped real
  # CI run.
  @requires-broad-rbac
  Scenario: Deploy a chart from a folder, verify it in k8s, then check it over REST
    Given Helm Chart "<NginxHelmChart>" in "./charts/test-nginx"
    And Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "nginx-release" in "dev"
    When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
    Then the command succeeds
    When I get status of Helm Release "<NginxRelease>" as YAML
    Then Helm Release "<NginxRelease>" is "deployed"

    Given Deployment "<NginxDeployment>"
    And "<NginxDeployment>" namespace is "dev"
    And "<NginxDeployment>" label "app.kubernetes.io/instance" is "nginx-release"
    When I get Deployment "<NginxDeployment>" as JSON
    Then Deployment "<NginxDeployment>" has "status.readyReplicas" >= 1

    Given Service "<NginxService>"
    And "<NginxService>" namespace is "dev"
    And "<NginxService>" label "app.kubernetes.io/instance" is "nginx-release"
    When I get Service "<NginxService>" as JSON
    Then Service "<NginxService>" has "spec.type" == ClusterIP
    And HTTP Endpoint "<NginxApi>" on "<NginxService>" port "80"
    When I send a GET request to Endpoint known as "<NginxApi>" path "/"
    Then the response status is 200

    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0 STDOUT contains uninstalled
