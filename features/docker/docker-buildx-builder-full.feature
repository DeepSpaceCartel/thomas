Feature: BDD Framework for Docker Buildx Builders (full table syntax)
  As a platform engineer
  I want to create, use, and remove a real `docker buildx` builder backed
  by a remote BuildKit endpoint using the full PROPERTY|VALUE / OPTION|VALUE
  table forms
  So that I can functionally test building and pushing a real image,
  with every field spelled out explicitly

  Background:
    Given URL known as "<BuildkitRepoUrl>":
      | PROPERTY | VALUE                             |
      | value    | https://andrcuns.github.io/charts |

    Given Directory known as "<TestRegistryChartDirectory>":
      | PROPERTY | VALUE                   |
      | path     | ./charts/test-registry |
    And Helm Chart known as "<TestRegistryChart>":
      | PROPERTY | VALUE                        |
      | chart    | <TestRegistryChartDirectory> |
    And Helm Release known as "<TestRegistryRelease>":
      | PROPERTY  | VALUE                       |
      | chart     | <TestRegistryChart>         |
      | name      | thomas-docker-full-registry |
      | namespace | thomas-helm-test            |
    When I upgrade Helm Release known as "<TestRegistryRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    # A real, disposable BuildKit instance trusting our real, disposable
    # test registry as plain HTTP - no mocks, and no dependency on any
    # BuildKit instance outside Thomas's own control. Needs a namespace
    # whose PodSecurity level allows a privileged (or rootless-unconfined)
    # pod - see docs/reference/DOCKER.md.
    Given Helm Chart known as "<BuildkitChart>":
      | PROPERTY | VALUE              |
      | chart    | buildkit-service   |
      | repo     | <BuildkitRepoUrl> |
    And Helm Release known as "<BuildkitRelease>":
      | PROPERTY  | VALUE                       |
      | chart     | <BuildkitChart>             |
      | name      | thomas-docker-full-buildkit |
      | namespace | thomas-helm-test            |
    When I upgrade Helm Release known as "<BuildkitRelease>" with:
      | OPTION             | VALUE                                         |
      | --install          | True                                          |
      | --atomic           | True                                          |
      | --create-namespace | True                                          |
      | --set-file         | buildkitdToml=fixtures/docker/buildkitd.toml |
    Then the command exited with 0

  Scenario: Creating a Docker Buildx Builder, building and pushing a real image, then removing it
    Given Docker Buildx Builder known as "<Builder>":
      | PROPERTY | VALUE                                                                                       |
      | name     | thomas-docker-full-builder                                                                 |
      | endpoint | tcp://thomas-docker-full-buildkit-buildkit-service.thomas-helm-test.svc.cluster.local:1234 |
    When I create Docker Buildx Builder known as "<Builder>"
    Then the command exited with 0
    When I build and push "thomas-docker-full-registry-test-registry.thomas-helm-test.svc.cluster.local:5000/thomas-fixture:full" from "./fixtures/docker" using Docker Buildx Builder known as "<Builder>" with:
      | OPTION | VALUE |
    Then the command exited with 0
    When I remove Docker Buildx Builder known as "<Builder>"
    Then the command exited with 0
    When I uninstall Helm Release known as "<BuildkitRelease>" with:
      | OPTION  | VALUE |
      | --wait  | True  |
    Then the command exited with 0
    When I uninstall Helm Release known as "<TestRegistryRelease>" with:
      | OPTION  | VALUE |
      | --wait  | True  |
    Then the command exited with 0
