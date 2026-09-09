Feature: BDD Framework for Helm Chart Dependencies (short syntax)
  As a DevOps engineer
  I want to resolve a chart's real dependencies against a real repository
  using the short single-condition oneline form where one exists
  So that subchart references are verified, not assumed

  Background:
    Given Directory "<DependencyChartDirectory>" at "./charts/test-dependency"
    And Directory "<DownloadsDirectory>" at "./charts/test-dependency/charts"
    When I purge Directory known as "<DownloadsDirectory>"

  Scenario: Updating Chart Dependencies
    When I list dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0 STDOUT contains missing
    When I update dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0 STDOUT contains "Saving 1 charts"
    When I list dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0 STDOUT contains ok

  Scenario: Building Chart Dependencies from Chart.lock
    When I update dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0
    When I purge Directory known as "<DownloadsDirectory>"
    When I build dependencies for Directory known as "<DependencyChartDirectory>"
    Then the command exited with 0 STDOUT contains "Downloading metrics-server"
