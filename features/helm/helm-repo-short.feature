Feature: BDD Framework for Helm Repositories (short syntax)
  As a DevOps engineer
  I want to register real Helm chart repositories using the short oneline
  and `with <flags>` forms
  So that scenarios referencing a chart by "repo-alias/name" can resolve
  it, reading the least amount of Gherkin necessary to do it

  Scenario: Adding a Helm Repo
    Given URL "<MetricsServerRepoUrl>" at "https://kubernetes-sigs.github.io/metrics-server/"
    And Helm Repo "<ThomasAddExampleRepo>" named "thomas-add-example" at "<MetricsServerRepoUrl>"
    When I add Helm Repo "<ThomasAddExampleRepo>" with --insecure-skip-tls-verify
    Then the command exited with 0 STDOUT contains "has been added to your repositories"
    And I list Helm Repo with --output yaml
    Then the command result has "[*].name" is thomas-add-example
    And I remove Helm Repo known as "<ThomasAddExampleRepo>"
    Then the command exited with 0

  Scenario: Listing Helm Repos
    Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
    And Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "<BitnamiRepoUrl>"
    When I add Helm Repo known as "<BitnamiHelmRepo>"
    And I list Helm Repo with --output yaml
    Then the command result has "[*].name" is bitnami

  Scenario: Removing a Helm Repo
    Given URL "<MetricsServerRepoUrl>" at "https://kubernetes-sigs.github.io/metrics-server/"
    And Helm Repo "<ThomasRemoveExampleRepo>" named "thomas-remove-example" at "<MetricsServerRepoUrl>"
    When I add Helm Repo known as "<ThomasRemoveExampleRepo>"
    And I remove Helm Repo "<ThomasRemoveExampleRepo>" with --debug
    Then the command exited with 0 STDOUT contains "has been removed from your repositories"
    And I list Helm Repo with --output yaml
    Then the command result has "[*].name" is not thomas-remove-example

  Scenario: Updating a Helm Repo
    Given URL "<MetricsServerRepoUrl>" at "https://kubernetes-sigs.github.io/metrics-server/"
    And Helm Repo "<MetricsServerHelmRepo>" named "metrics-server" at "<MetricsServerRepoUrl>"
    When I add Helm Repo known as "<MetricsServerHelmRepo>"
    And I update Helm Repo "<MetricsServerHelmRepo>" with --fail-on-repo-update-fail
    Then the command exited with 0
