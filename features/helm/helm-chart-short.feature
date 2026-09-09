Feature: BDD Framework for Helm Charts (short syntax)
  As a DevOps engineer
  I want to deploy Helm charts and verify their status using the short
  oneline and `with <flags>` forms
  So that I can ensure my deployments are successful and meet the required
  conditions, reading the least amount of Gherkin necessary to do it

  Scenario: Defining Local Helm Chart
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Chart "<LocalNginxHelmChart>" has "apiVersion" is v2
    And Helm Chart "<LocalNginxHelmChart>" has "name" is test-nginx
    And Helm Chart "<LocalNginxHelmChart>" has "description" contains nginx
    And Helm Chart "<LocalNginxHelmChart>" has "type" is application
    And Helm Chart "<LocalNginxHelmChart>" has "version" is 0.1.0
    And Helm Chart "<LocalNginxHelmChart>" has "appVersion" is 1.27

  Scenario: Defining Local Archive Chart
    Given File "<NginxChartFile>" at "./charts/test-nginx-0.1.0.tgz"
    And Helm Chart "<LocalArchiveNginxHelmChart>" in "<NginxChartFile>"
    And Helm Chart "<LocalArchiveNginxHelmChart>" has "apiVersion" is v2
    And Helm Chart "<LocalArchiveNginxHelmChart>" has "name" is test-nginx
    And Helm Chart "<LocalArchiveNginxHelmChart>" has "description" contains nginx
    And Helm Chart "<LocalArchiveNginxHelmChart>" has "type" is application
    And Helm Chart "<LocalArchiveNginxHelmChart>" has "version" is 0.1.0
    And Helm Chart "<LocalArchiveNginxHelmChart>" has "appVersion" is 1.27

  Scenario: Defining URL Chart
    Given URL "<NginxChartUrl>" at "https://charts.bitnami.com/bitnami/nginx-18.2.5.tgz"
    And Helm Chart "<UrlNginxHelmChart>" in "<NginxChartUrl>"
    And Helm Chart "<UrlNginxHelmChart>" has "apiVersion" is v2
    And Helm Chart "<UrlNginxHelmChart>" has "name" is nginx
    And Helm Chart "<UrlNginxHelmChart>" has "description" contains NGINX
    And Helm Chart "<UrlNginxHelmChart>" has "type" undefined
    And Helm Chart "<UrlNginxHelmChart>" has "version" is 18.2.5
    And Helm Chart "<UrlNginxHelmChart>" has "appVersion" is 1.27.2

  Scenario: Defining Reference Chart
    Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
    And Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "<BitnamiRepoUrl>"
    When I add Helm Repo known as "<BitnamiHelmRepo>"
    And Helm Chart "<ReferenceNginxHelmChart>" in "bitnami/nginx" version "25.1.10"
    And Helm Chart "<ReferenceNginxHelmChart>" has "apiVersion" is v2
    And Helm Chart "<ReferenceNginxHelmChart>" has "name" is nginx
    And Helm Chart "<ReferenceNginxHelmChart>" has "description" contains NGINX
    And Helm Chart "<ReferenceNginxHelmChart>" has "type" undefined
    And Helm Chart "<ReferenceNginxHelmChart>" has "version" is 25.1.10
    And Helm Chart "<ReferenceNginxHelmChart>" has "appVersion" is 1.31.5

  Scenario: Defining Reference Chart via Repo
    Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
    And Helm Chart "<RepoReferenceNginxHelmChart>" in "nginx" repo "<BitnamiRepoUrl>" version "25.1.10"
    And Helm Chart "<RepoReferenceNginxHelmChart>" has "apiVersion" is v2
    And Helm Chart "<RepoReferenceNginxHelmChart>" has "name" is nginx
    And Helm Chart "<RepoReferenceNginxHelmChart>" has "description" contains NGINX
    And Helm Chart "<RepoReferenceNginxHelmChart>" has "type" undefined
    And Helm Chart "<RepoReferenceNginxHelmChart>" has "version" is 25.1.10
    And Helm Chart "<RepoReferenceNginxHelmChart>" has "appVersion" is 1.31.5

  Scenario: Defining OCI Chart
    Given OCI Artifact "<NginxOciArtifact>" at "oci://registry-1.docker.io/bitnamicharts/nginx:25.1.10"
    And Helm Chart "<OciNginxHelmChart>" in "<NginxOciArtifact>"
    And Helm Chart "<OciNginxHelmChart>" has "apiVersion" is v2
    And Helm Chart "<OciNginxHelmChart>" has "name" is nginx
    And Helm Chart "<OciNginxHelmChart>" has "description" contains NGINX
    And Helm Chart "<OciNginxHelmChart>" has "type" undefined
    And Helm Chart "<OciNginxHelmChart>" has "version" is 25.1.10
    And Helm Chart "<OciNginxHelmChart>" has "appVersion" is 1.31.5

  Scenario: Templating a Helm Chart
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I template Helm Chart "<LocalNginxHelmChart>" with test-nginx
    Then the command exited with 0 STDOUT contains "# Source: test-nginx/templates/service.yaml"

  Scenario: Showing a Helm Chart's definition
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I show chart for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command result has "name" is test-nginx

  Scenario: Showing a Helm Chart's values
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I show values for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command result has "replicaCount" is 1

  Scenario: Showing a Helm Chart's README
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I show readme for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command exited with 0 STDOUT contains "Minimal stock-nginx deployment"

  Scenario: Showing a Helm Chart's CRDs
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I show crds for Helm Chart "<LocalNginxHelmChart>" with --devel
    Then the command exited with 0

  Scenario: Showing all information about a Helm Chart
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<LocalNginxHelmChart>" in "<NginxChartDirectory>"
    When I show all for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command exited with 0 STDOUT contains "name: test-nginx"
    Then the command exited with 0 STDOUT contains "replicaCount: 1"
