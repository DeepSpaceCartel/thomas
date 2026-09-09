Feature: BDD Framework for Helm Repositories (full table syntax)
  As a DevOps engineer
  I want to register real Helm chart repositories using the full
  PROPERTY|VALUE / OPTION|VALUE table forms
  So that scenarios referencing a chart by "repo-alias/name" can resolve
  it, with every field spelled out explicitly

  Scenario: Adding a Helm Repo
    Given URL known as "<MetricsServerRepoUrl>":
      | PROPERTY | VALUE                                              |
      | value    | https://kubernetes-sigs.github.io/metrics-server/ |
    And Helm Repo known as "<ThomasAddExampleRepo>":
      | PROPERTY | VALUE                     |
      | name     | thomas-add-example        |
      | url      | <MetricsServerRepoUrl>   |
    When I add Helm Repo known as "<ThomasAddExampleRepo>" with:
      | OPTION                     | VALUE |
      | --insecure-skip-tls-verify | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                |
      | STDOUT | contains  | has been added to your repositories  |
    And I list Helm Repo with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY      | CONDITION | VALUE               |
      | [*].name | equals    | thomas-add-example |
    And I remove Helm Repo known as "<ThomasAddExampleRepo>"
    Then the command exited with 0

  Scenario: Listing Helm Repos
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    And Helm Repo known as "<BitnamiHelmRepo>":
      | PROPERTY | VALUE             |
      | name     | bitnami           |
      | url      | <BitnamiRepoUrl> |
    When I add Helm Repo known as "<BitnamiHelmRepo>"
    And I list Helm Repo with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY      | CONDITION | VALUE   |
      | [*].name | equals    | bitnami |

  Scenario: Removing a Helm Repo
    Given URL known as "<MetricsServerRepoUrl>":
      | PROPERTY | VALUE                                              |
      | value    | https://kubernetes-sigs.github.io/metrics-server/ |
    And Helm Repo known as "<ThomasRemoveExampleRepo>":
      | PROPERTY | VALUE                    |
      | name     | thomas-remove-example    |
      | url      | <MetricsServerRepoUrl>  |
    When I add Helm Repo known as "<ThomasRemoveExampleRepo>"
    And I remove Helm Repo known as "<ThomasRemoveExampleRepo>" with:
      | OPTION  | VALUE |
      | --debug | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                   |
      | STDOUT | contains  | has been removed from your repositories |
    And I list Helm Repo with:
      | OPTION   | VALUE |
      | --output | yaml  |
    Then the command result data has:
      | KEY      | CONDITION  | VALUE                  |
      | [*].name | not_equals | thomas-remove-example |

  Scenario: Updating a Helm Repo
    Given URL known as "<MetricsServerRepoUrl>":
      | PROPERTY | VALUE                                              |
      | value    | https://kubernetes-sigs.github.io/metrics-server/ |
    And Helm Repo known as "<MetricsServerHelmRepo>":
      | PROPERTY | VALUE                    |
      | name     | metrics-server           |
      | url      | <MetricsServerRepoUrl>  |
    When I add Helm Repo known as "<MetricsServerHelmRepo>"
    And I update Helm Repo known as "<MetricsServerHelmRepo>" with:
      | OPTION                     | VALUE |
      | --fail-on-repo-update-fail | True  |
    Then the command exited with 0
