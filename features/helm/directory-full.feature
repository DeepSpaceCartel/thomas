Feature: BDD Framework for Directory-scoped Helm commands (full table syntax)
  As a DevOps engineer
  I want to run the `helm` subcommands that only accept a local chart
  directory (index, lint, package, dependency) using the full
  PROPERTY|VALUE / OPTION|VALUE table forms
  So that I can validate a chart's source before it's ever installed,
  with every field spelled out explicitly

  Scenario: Indexing a Chart Directory
    Given Directory known as "<ChartsDirectory>":
      | PROPERTY | VALUE   |
      | path     | ./charts |
    When I index Directory known as "<ChartsDirectory>" with:
      | OPTION | VALUE |
      | --json | True  |
    Then the command exited with 0
    # No flags to pass at all here - the bare table-less form, same in
    # both this file and directory-short.feature (nothing to shorten).
    When I index Directory known as "<ChartsDirectory>"
    Then the command exited with 0

  Scenario: Linting a Chart Directory
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    When I lint Directory known as "<NginxChartDirectory>" with:
      | OPTION   | VALUE |
      | --strict | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                |
      | STDOUT | contains  | 1 chart(s) linted, 0 chart(s) failed |
    When I lint Directory known as "<NginxChartDirectory>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                |
      | STDOUT | contains  | 1 chart(s) linted, 0 chart(s) failed |

  Scenario: Packaging a Chart Directory
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    When I package Directory known as "<NginxChartDirectory>" with:
      | OPTION        | VALUE  |
      | --destination | .cache |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                       |
      | STDOUT | contains  | Successfully packaged chart |

  Scenario: Listing Chart Dependencies
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    When I list dependencies for Directory known as "<NginxChartDirectory>" with:
      | OPTION          | VALUE |
      | --max-col-width | 200   |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE              |
      | STDOUT | contains  | no dependencies at |
