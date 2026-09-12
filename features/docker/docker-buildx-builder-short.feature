Feature: BDD Framework for Docker Buildx Builders (short syntax)
  As a platform engineer
  I want to create, use, and remove a real `docker buildx` builder backed
  by a remote BuildKit endpoint using the short oneline and `with <flags>`
  forms
  So that I can functionally test building and pushing a real image,
  reading the least amount of Gherkin necessary to do it

  Background:
    Given URL "<BuildkitRepoUrl>" at "https://andrcuns.github.io/charts"
    Given Directory "<TestRegistryChartDirectory>" at "./charts/test-registry"
    And Helm Chart "<TestRegistryChart>" in "<TestRegistryChartDirectory>"
    And Helm Release "<TestRegistryRelease>" of "<TestRegistryChart>" named "thomas-docker-short-registry" in "thomas-helm-test"
    When I upgrade Helm Release "<TestRegistryRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    # A real, disposable BuildKit instance trusting our real, disposable
    # test registry as plain HTTP - see docker-buildx-builder-full.feature's
    # Background for why, and docs/reference/DOCKER.md for the namespace
    # PodSecurity prerequisite.
    Given Helm Chart known as "<BuildkitChart>":
      | PROPERTY | VALUE              |
      | chart    | buildkit-service   |
      | repo     | <BuildkitRepoUrl> |
    And Helm Release "<BuildkitRelease>" of "<BuildkitChart>" named "thomas-docker-short-buildkit" in "thomas-helm-test"
    When I upgrade Helm Release "<BuildkitRelease>" with --install --atomic --create-namespace --set-file buildkitdToml=fixtures/docker/buildkitd.toml
    Then the command exited with 0

  Scenario: Creating a Docker Buildx Builder, building and pushing a real image, then removing it
    Given Docker Buildx Builder "<Builder>" named "thomas-docker-short-builder" at "tcp://thomas-docker-short-buildkit-buildkit-service.thomas-helm-test.svc.cluster.local:1234"
    When I create Docker Buildx Builder known as "<Builder>"
    Then the command exited with 0
    When I build and push "thomas-docker-short-registry-test-registry.thomas-helm-test.svc.cluster.local:5000/thomas-fixture:short" from "./fixtures/docker" using Docker Buildx Builder known as "<Builder>" with --platform linux/amd64
    Then the command exited with 0
    When I remove Docker Buildx Builder known as "<Builder>"
    Then the command exited with 0
    When I uninstall Helm Release "<BuildkitRelease>" with --wait
    Then the command exited with 0
    When I uninstall Helm Release "<TestRegistryRelease>" with --wait
    Then the command exited with 0
