Feature: BDD Framework for Directory-scoped Helm commands (short syntax)
  As a DevOps engineer
  I want to run the `helm` subcommands that only accept a local chart
  directory (index, lint, package, dependency) using the short oneline
  and `with <flags>` forms
  So that I can validate a chart's source before it's ever installed,
  reading the least amount of Gherkin necessary to do it

  Scenario: Indexing a Chart Directory
    Given Directory "<ChartsDirectory>" at "./charts"
    When I index Directory "<ChartsDirectory>" with --json
    Then the command exited with 0
    # No flags to pass at all here - the bare table-less form, same in
    # both this file and directory-full.feature (nothing to shorten).
    When I index Directory known as "<ChartsDirectory>"
    Then the command exited with 0

  Scenario: Linting a Chart Directory
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    When I lint Directory "<NginxChartDirectory>" with --strict
    Then the command exited with 0 STDOUT contains "1 chart(s) linted, 0 chart(s) failed"
    When I lint Directory known as "<NginxChartDirectory>"
    Then the command exited with 0 STDOUT contains "1 chart(s) linted, 0 chart(s) failed"

  Scenario: Packaging a Chart Directory
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    When I package Directory "<NginxChartDirectory>" with --destination .cache
    Then the command exited with 0 STDOUT contains "Successfully packaged chart"

  Scenario: Listing Chart Dependencies
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    When I list dependencies for Directory "<NginxChartDirectory>" with --max-col-width 200
    Then the command exited with 0 STDOUT contains "no dependencies at"
