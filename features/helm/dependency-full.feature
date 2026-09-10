Feature: BDD Framework for Helm Chart Dependencies (full syntax)
  As a DevOps engineer
  I want to resolve a chart's real dependencies against a real repository
  So that subchart references are verified, not assumed

  Background:
    Given Directory "<DependencyChartDirectory>" at "./charts/test-dependency"
    And Directory "<DownloadsDirectory>" at "./charts/test-dependency/charts"
    When I purge Directory known as "<DownloadsDirectory>"

  Scenario: Updating Chart Dependencies
    When I list dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE   |
      | STDOUT | contains  | missing |
    When I update dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE           |
      | STDOUT | contains  | Saving 1 charts |
    When I list dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE |
      | STDOUT | contains  | ok    |

  Scenario: Building Chart Dependencies from Chart.lock
    When I update dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0
    When I purge Directory known as "<DownloadsDirectory>"
    # `helm dependency update` (above) resolves this repo as a real,
    # one-off "unmanaged" lookup - confirmed for real it does NOT
    # register it - so `helm dependency build` (which trusts Chart.lock
    # strictly rather than re-resolving) genuinely needs it registered
    # for real first, on a machine that's never run `helm repo add` for
    # it before.
    Given URL known as "<MetricsServerRepoUrl>":
      | PROPERTY | VALUE                                             |
      | value    | https://kubernetes-sigs.github.io/metrics-server/ |
    And Helm Repo known as "<MetricsServerRepo>":
      | PROPERTY | VALUE                  |
      | name     | metrics-server         |
      | url      | <MetricsServerRepoUrl> |
    When I add Helm Repo known as "<MetricsServerRepo>"
    Then the command exited with 0
    When I build dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                      |
      | STDOUT | contains  | Downloading metrics-server |
