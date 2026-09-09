Feature: URL resource validation (short syntax)

  Scenario: Defining a URL
    Given URL "<NginxChartUrl>" at "https://charts.bitnami.com/bitnami/nginx-18.2.5.tgz"

  Scenario: Rejecting an unknown property
    Given "<BadUrlPayload>" field "xxx" is "https://example.com/x"
    When I attempt to define URL known as "<BadUrl>" using "<BadUrlPayload>"
    Then it should have failed with 'URL has no field "xxx"'

  Scenario: Rejecting a malformed URL
    Given "<MalformedUrlPayload>" field "value" is "not-a-url"
    When I attempt to define URL known as "<MalformedUrl>" using "<MalformedUrlPayload>"
    Then it should have failed with 'URL is not well-formed'

  Scenario: Rejecting a non-http(s) URL
    Given "<FtpUrlPayload>" field "value" is "ftp://example.com/chart.tgz"
    When I attempt to define URL known as "<FtpUrl>" using "<FtpUrlPayload>"
    Then it should have failed with 'URL must be http(s)'

  Scenario: Referencing an unregistered URL resource from a Helm Chart
    Given "<BadChartPayload>" field "chart" is "<UndefinedUrl>"
    When I attempt to define Helm Chart known as "<BadChart>" using "<BadChartPayload>"
    Then it should have failed with 'No Resource registered as "<UndefinedUrl>"'
